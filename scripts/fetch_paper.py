#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "pyyaml", "pypdf"]
# ///
"""摄取一篇 arXiv 论文：取元数据 + 全文（HTML 版优先，PDF 版回退），生成
`sources/papers/<arxiv-id>/{meta.yaml,anchors.md}`，全文缓存到
`.cache/papers/<arxiv-id>/paper.md`（spec CLAUDE.md "录入流程"）。

用法:
    uv run scripts/fetch_paper.py <arxiv-url-or-id>
    uv run scripts/fetch_paper.py 2611.05306
    uv run scripts/fetch_paper.py https://arxiv.org/abs/2611.05306

网络（Task 17 binding decisions）:
    - 元数据: arXiv Atom API `https://export.arxiv.org/api/query?id_list=<id>`。
    - 全文: 先取 arXiv HTML 版 `https://arxiv.org/html/<id>`，404 时回退一次
      `https://arxiv.org/html/<id>v1`；两者都不可用则回退到 PDF 版
      `https://arxiv.org/pdf/<id>`（pypdf 抽取文本）。
    - 超时 30s，5xx/超时各重试一次（等待 3s）；每次请求之间至少间隔 3s
      （arXiv 礼仪：同一次运行内不超过 1 请求/3 秒）。
    - User-Agent 用通用标识 `agent-llm-wiki-fetch/1.0`，不带个人信息。

`sources/` 只增不改：meta.yaml 已存在时不覆盖（字段不同则警告，不改动）；
anchors.md 只允许追加（见 `merge_anchors`）。

`meta.yaml` 用 PyYAML `safe_dump(allow_unicode=True, sort_keys=False)`
渲染（而不是 `lib/transcribe.py` 里那套给纯字符串/布尔值用的 frontmatter
scalar 渲染器）：这里的 `authors` 是列表，PyYAML 的 dumper 原生处理得更
直接。

写完 `anchors.md` 后用 `lib.anchors.verify_against_fulltext` 自检一遍
（与 `lint.py` 的核验同一份逻辑）：任何一条锚点在全文缓存里找不到逐字
匹配就报错退出（fix round 1, item 1）。
"""

from __future__ import annotations

import argparse
import re
import sys
import time
from pathlib import Path
from xml.etree import ElementTree as ET

import requests

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from lib.anchors import parse_anchors_md, verify_against_fulltext  # noqa: E402
from lib.transcribe import validate_safe_id, within  # noqa: E402

SOURCES = ROOT / "sources"
CACHE = ROOT / ".cache"

USER_AGENT = "agent-llm-wiki-fetch/1.0"
REQUEST_TIMEOUT = 30
RETRY_SLEEP = 3.0
MIN_REQUEST_INTERVAL = 3.0  # arXiv 礼仪：同一次运行内不超过 1 请求/3 秒

ATOM_API = "https://export.arxiv.org/api/query?id_list={id}"
HTML_URL = "https://arxiv.org/html/{id}"
PDF_URL = "https://arxiv.org/pdf/{id}"

ATOM_NS = {"a": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}

ARXIV_ID_RE = re.compile(r"(\d{4}\.\d{4,5})")

# Appendix section ids (e.g. "A", "A.1") are intentionally NOT turned into
# anchors — the shared `§` grammar in lib/anchors.py is `\d+(\.\d+)*` only
# (see Task 17 binding decisions: "skip appendix sections instead and note
# it" rather than extending the format). Only numeric chapter/section ids
# become `## §<num> <title>` anchors.
NUMERIC_SECTION_RE = re.compile(r"^\d+(?:\.\d+)*$")

# Figure/Table caption text is truncated to 120 chars (Task 17 binding
# decisions / brief's Interfaces section); whole anchors.md line stays
# well under the Step 1 test's <= 140 char ceiling.
CAPTION_MAX_CHARS = 120

_last_request_time = 0.0


def _throttle() -> None:
    """Sleep as needed so this process makes at most 1 request per
    `MIN_REQUEST_INTERVAL` seconds (arXiv etiquette).
    """
    global _last_request_time
    elapsed = time.monotonic() - _last_request_time
    if elapsed < MIN_REQUEST_INTERVAL:
        time.sleep(MIN_REQUEST_INTERVAL - elapsed)
    _last_request_time = time.monotonic()


def _get(url: str) -> "requests.Response | None":
    """GET `url` with the shared User-Agent, timeout, one retry on 5xx or
    timeout (after a 3s sleep), and the arXiv-etiquette throttle. Returns
    the response for any status code other than a retried failure typically
    delivers (i.e. the caller still must check `.status_code`), or `None`
    if even the retry fails to connect/timeout a second time and the
    caller should treat that as "unavailable".
    """
    headers = {"User-Agent": USER_AGENT}
    for attempt in range(2):
        _throttle()
        try:
            resp = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
        except requests.exceptions.Timeout:
            if attempt == 0:
                time.sleep(RETRY_SLEEP)
                continue
            return None
        if resp.status_code >= 500 and attempt == 0:
            time.sleep(RETRY_SLEEP)
            continue
        return resp
    return None


def parse_arxiv_id(s: str) -> str:
    """Extract the bare arXiv id (no version suffix) from a URL or bare id:
    `https://arxiv.org/abs/2611.05306`, `.../pdf/2611.05306v2`, or
    `2611.05306`. Raises `ValueError` for anything that doesn't contain a
    recognisable `NNNN.NNNNN` id.
    """
    match = ARXIV_ID_RE.search(s)
    if not match:
        raise ValueError(f"不是合法的 arXiv id 或 URL: {s!r}")
    return match.group(1)


def parse_atom(xml_text: str) -> dict:
    """Parse an arXiv Atom API response (single `<entry>`) into the
    `meta.yaml` fields: `id`, `title`, `authors`, `published`, `updated`,
    `abs_url`, `pdf_url`, `primary_category`, `comment`.
    """
    root = ET.fromstring(xml_text)
    entry = root.find("a:entry", ATOM_NS)
    if entry is None:
        raise ValueError("Atom 响应中没有 <entry>（id 不存在或 arXiv API 出错）")

    entry_id = entry.find("a:id", ATOM_NS).text.strip()
    arxiv_id = parse_arxiv_id(entry_id)

    title = entry.find("a:title", ATOM_NS).text.strip()
    title = re.sub(r"\s+", " ", title)

    authors = [
        a.find("a:name", ATOM_NS).text.strip()
        for a in entry.findall("a:author", ATOM_NS)
    ]

    published = entry.find("a:published", ATOM_NS)
    updated = entry.find("a:updated", ATOM_NS)

    abs_url = ""
    pdf_url = ""
    for link in entry.findall("a:link", ATOM_NS):
        link_type = link.get("type", "")
        if link_type == "text/html":
            abs_url = link.get("href", "")
        elif link_type == "application/pdf":
            pdf_url = link.get("href", "")

    comment_el = entry.find("arxiv:comment", ATOM_NS)
    primary_cat_el = entry.find("arxiv:primary_category", ATOM_NS)

    return {
        "id": arxiv_id,
        "title": title,
        "authors": authors,
        "published": published.text.strip() if published is not None else "",
        "updated": updated.text.strip() if updated is not None else "",
        "abs_url": abs_url,
        "pdf_url": pdf_url,
        "primary_category": primary_cat_el.get("term", "") if primary_cat_el is not None else "",
        "comment": comment_el.text.strip() if comment_el is not None and comment_el.text else "",
    }


MATH_ALTTEXT_RE = re.compile(r'<math\b[^>]*\balttext="([^"]*)"[^>]*>.*?</math>', re.S)


def _strip_tags(html_fragment: str) -> str:
    """Remove all tags from an HTML fragment, collapsing whitespace, with
    MathML `<math>` elements rendered once from their `alttext` attribute
    instead of their visible rendered content (fix round 1, item 2):
    arXiv's LaTeXML HTML repeats each formula as both rendered MathML
    (`<mn>1</mn>`, etc.) and a textual `<annotation>` holding the LaTeX
    source, which otherwise doubles up in the tag-stripped text (e.g.
    "generating 1 1 M output tokens", "τ 2 \\tau^{2} -bench"). Replacing
    the whole `<math>...</math>` element (which also removes its nested
    `<annotation>`/`<annotation-xml>` children) with just its `alttext`
    value makes the formula appear exactly once.

    Used for figure/table captions (and, by `main`, for the whole cached
    `paper.md` full text, so `anchors.md` captions stay a verbatim
    substring of the cache for `verify_against_fulltext`).
    """
    text = MATH_ALTTEXT_RE.sub(lambda m: m.group(1), html_fragment)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _truncate(text: str, max_chars: int) -> str:
    """Truncate `text` to at most `max_chars`, without appending any
    marker (fix round 1, item 1 — a trailing `…` can never verbatim-match
    the cached full text, which `lint.py`'s `verify_against_fulltext`
    requires). Prefers cutting right after the last sentence/clause
    boundary (`.`, `。`, `;`, `；`, `:`, `：`) at or before `max_chars`;
    falls back to the last whitespace at or before `max_chars`; falls
    back to a hard cut at `max_chars` if neither exists. The result is
    always an exact prefix (substring) of `text`.
    """
    if len(text) <= max_chars:
        return text

    window = text[:max_chars]
    boundary = max(
        (window.rfind(ch) for ch in ".。;；:："),
        default=-1,
    )
    if boundary != -1:
        return window[: boundary + 1]

    space = window.rfind(" ")
    if space > 0:
        return window[:space]

    return window


SECTION_HEADING_HTML_RE = re.compile(
    r'<h[0-9]\s+class="ltx_title ltx_title_(section|subsection|subsubsection)">'
    r'<span class="ltx_tag ltx_tag_(?:section|subsection|subsubsection)">([^<]*)</span>'
    r"(.*?)</h[0-9]>",
    re.S,
)
FIGURE_CAPTION_HTML_RE = re.compile(
    r'<figcaption class="ltx_caption[^"]*"[^>]*>\s*'
    r'<span class="ltx_tag ltx_tag_figure">Figure\s+(\d+):\s*</span>'
    r"(.*?)</figcaption>",
    re.S,
)
TABLE_CAPTION_HTML_RE = re.compile(
    r'<figcaption class="ltx_caption[^"]*"[^>]*>\s*'
    r'<span class="ltx_tag ltx_tag_(?:figure|table)">Table\s+(\d+):\s*</span>'
    r"(.*?)</figcaption>",
    re.S,
)


def anchors_from_html(html: str) -> list[str]:
    """Extract anchor lines from arXiv's LaTeXML HTML rendering: section
    headings (`.ltx_title_section`/`subsection`/`subsubsection`, tagged
    with a numeric id like "3.2 ") become `## §3.2 <title>`; figure
    captions ("Figure 4: …") become `- Fig. 4 — <desc>` (desc truncated to
    120 chars); table captions become `- Tab. 2 — <desc>` likewise.

    Appendix sections (`ltx_title_appendix`, ids like "A", "A.1") are
    deliberately skipped: the shared `§` grammar in `lib/anchors.py` only
    recognises `\\d+(\\.\\d+)*` keys, and extending it is out of scope
    (Task 17 binding decisions) — so appendix headings produce no anchor
    line at all, section numbering falls through to the next numeric
    heading unaffected.
    """
    anchors: list[str] = []

    for match in SECTION_HEADING_HTML_RE.finditer(html):
        raw_num, title = match.group(2), match.group(3)
        num = raw_num.strip()
        if not NUMERIC_SECTION_RE.match(num):
            continue  # appendix id (e.g. "A", "A.1") — skip per binding decisions
        title = _strip_tags(title).strip(" .")
        if title:
            anchors.append(f"## §{num} {title}")

    for match in FIGURE_CAPTION_HTML_RE.finditer(html):
        n, desc = match.group(1), match.group(2)
        desc = _truncate(_strip_tags(desc), CAPTION_MAX_CHARS)
        anchors.append(f"- Fig. {n} — {desc}")

    for match in TABLE_CAPTION_HTML_RE.finditer(html):
        n, desc = match.group(1), match.group(2)
        desc = _truncate(_strip_tags(desc), CAPTION_MAX_CHARS)
        anchors.append(f"- Tab. {n} — {desc}")

    return anchors


SECTION_HEADING_PDF_RE = re.compile(r"^(\d+(?:\.\d+)*)\s+([A-Z][^\n]{2,80})$")
FIGTAB_PDF_RE = re.compile(r"^(Figure|Fig\.|Table)\s*(\d+)[:.]\s*(.+)")


def anchors_from_pdf_text(text: str) -> list[str]:
    """Fallback anchor extraction from pypdf-extracted plain text, used
    when the arXiv HTML version isn't available (non-200 on both the
    bare and `v1`-suffixed URL). Section headings match
    `^(\\d+(?:\\.\\d+)*)\\s+([A-Z][^\\n]{2,80})$` (a numbered heading
    line on its own, as pypdf tends to emit them); figure/table captions
    match `^(Figure|Fig\\.|Table)\\s*(\\d+)[:.]\\s*(.+)`.
    """
    anchors: list[str] = []
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue

        section_match = SECTION_HEADING_PDF_RE.match(line)
        if section_match:
            num, title = section_match.group(1), section_match.group(2)
            anchors.append(f"## §{num} {title.strip()}")
            continue

        figtab_match = FIGTAB_PDF_RE.match(line)
        if figtab_match:
            kind, n, desc = figtab_match.group(1), figtab_match.group(2), figtab_match.group(3)
            label = "Fig." if kind in ("Figure", "Fig.") else "Tab."
            desc = _truncate(desc.strip(), CAPTION_MAX_CHARS)
            anchors.append(f"- {label} {n} — {desc}")

    return anchors


ANCHOR_KEY_RE = re.compile(
    r'^(?:## (§\d+(?:\.\d+)*)\b|- (Fig\.\s+\d+|Tab\.\s+\d+)\s+—)'
)


def _anchor_key(line: str) -> str | None:
    """The dedup key for an `anchors.md` line: `§<num>` for a `##` section
    heading, `Fig. <n>` / `Tab. <n>` for a bullet caption. Returns `None`
    for anything that isn't a recognised anchor line (so unrelated lines,
    e.g. quote lines already in the file, are never touched).
    """
    match = ANCHOR_KEY_RE.match(line)
    if not match:
        return None
    return match.group(1) or match.group(2)


def merge_anchors(existing: str, new: list[str]) -> str:
    """Append-only merge: `existing` (the current `anchors.md` text) is
    never modified — this function only ever adds lines at the end, for
    keys (`§<num>` section headings, `Fig. <n>`/`Tab. <n>` captions) not
    already present anywhere in `existing`. Running this twice with the
    same `new` is a no-op the second time (idempotent).
    """
    existing_keys = {
        key for line in existing.split("\n") if (key := _anchor_key(line)) is not None
    }

    to_append: list[str] = []
    appended_keys: set[str] = set()
    for line in new:
        key = _anchor_key(line)
        if key is None or key in existing_keys or key in appended_keys:
            continue
        to_append.append(line)
        appended_keys.add(key)

    if not to_append:
        return existing

    separator = "" if existing.endswith("\n") or existing == "" else "\n"
    return existing + separator + "\n".join(to_append) + "\n"


def fetch_html(arxiv_id: str) -> str | None:
    """Fetch arXiv's HTML rendering of `arxiv_id`, falling back once to
    the explicit `v1` suffix on a 404. Returns `None` if neither is
    available (non-200 both times).
    """
    resp = _get(HTML_URL.format(id=arxiv_id))
    if resp is not None and resp.status_code == 200:
        return resp.text
    if resp is not None and resp.status_code == 404:
        resp2 = _get(HTML_URL.format(id=arxiv_id) + "v1")
        if resp2 is not None and resp2.status_code == 200:
            return resp2.text
    return None


def fetch_pdf_text(arxiv_id: str) -> str | None:
    """Fetch and extract text from arXiv's PDF rendering of `arxiv_id`.
    Returns `None` if the PDF can't be fetched (non-200).
    """
    from pypdf import PdfReader
    import io

    resp = _get(PDF_URL.format(id=arxiv_id))
    if resp is None or resp.status_code != 200:
        return None
    reader = PdfReader(io.BytesIO(resp.content))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def write_meta_yaml(dest: Path, meta: dict) -> bool:
    """Write `dest/meta.yaml` using PyYAML `safe_dump(allow_unicode=True,
    sort_keys=False)` — chosen over `lib/transcribe.py`'s custom scalar
    renderer because `authors` is a list, which that renderer (built for
    flat frontmatter string/bool values) doesn't handle, while PyYAML's
    dumper already does.

    `sources/` is append-only: if `meta.yaml` already exists, this never
    overwrites it. If any field differs between the existing file and the
    freshly fetched `meta`, prints a warning and leaves the existing file
    untouched. Returns `True` if a file was written, `False` if skipped
    (already existed).
    """
    import yaml

    out_path = dest / "meta.yaml"
    if out_path.exists():
        existing = yaml.safe_load(out_path.read_text(encoding="utf-8")) or {}
        differing = [k for k in meta if k in existing and existing[k] != meta[k]]
        if differing:
            print(
                f"警告: {out_path} 已存在且以下字段与刚抓取的不同，"
                f"按 sources/ 只增不改规则保留现有文件: {', '.join(differing)}",
                file=sys.stderr,
            )
        else:
            print(f"已存在，跳过（sources/ 只增不改）: {out_path}")
        return False

    dest.mkdir(parents=True, exist_ok=True)
    out_path.write_text(yaml.safe_dump(meta, allow_unicode=True, sort_keys=False), encoding="utf-8")
    return True


def write_anchors_md(dest: Path, title: str, new_anchors: list[str]) -> bool:
    """Write or append-merge `dest/anchors.md`. A fresh file starts with
    `# <title>` then a blank line (parse_anchors_md ignores this line —
    it doesn't match any of the `##`/`-` anchor forms). Returns `True` if
    the file changed, `False` if nothing new was added (idempotent
    re-run). Creates `dest` if it doesn't exist yet (safe to call before
    `write_meta_yaml`, or standalone).
    """
    out_path = dest / "anchors.md"
    if out_path.exists():
        existing = out_path.read_text(encoding="utf-8")
        merged = merge_anchors(existing, new_anchors)
        if merged == existing:
            return False
        out_path.write_text(merged, encoding="utf-8")
        return True

    dest.mkdir(parents=True, exist_ok=True)
    header = f"# {title}\n\n"
    body = merge_anchors("", new_anchors)
    out_path.write_text(header + body, encoding="utf-8")
    return True


def self_check_anchors(anchors_path: Path, fulltext: str) -> list[str]:
    """After writing `anchors_path`, verify every anchor's title/caption
    is a verbatim (whitespace-normalized) substring of `fulltext` — the
    same check `lint.py`'s `check_cache_fulltext` runs, run here so a bad
    truncation or extraction bug is caught at fetch time rather than at
    the next `lint.py` run (fix round 1, item 1). Returns the list of
    missing keys (empty if everything verifies).
    """
    anchors = parse_anchors_md(anchors_path.read_text(encoding="utf-8"))
    return verify_against_fulltext(anchors, fulltext)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("arxiv", help="arXiv URL 或 id，如 2611.05306 / https://arxiv.org/abs/2611.05306")
    args = ap.parse_args(argv)

    try:
        arxiv_id = parse_arxiv_id(args.arxiv)
    except ValueError as e:
        print(f"错误: {e}", file=sys.stderr)
        return 2
    validate_safe_id(arxiv_id, "arXiv id")

    print(f"取元数据: {arxiv_id}")
    atom_resp = _get(ATOM_API.format(id=arxiv_id))
    if atom_resp is None or atom_resp.status_code != 200:
        print(f"错误: arXiv Atom API 请求失败（{arxiv_id}）", file=sys.stderr)
        return 1
    try:
        meta = parse_atom(atom_resp.text)
    except ValueError as e:
        print(f"错误: {e}", file=sys.stderr)
        return 1

    dest = SOURCES / "papers" / arxiv_id
    cache_dir = CACHE / "papers" / arxiv_id
    if not within(dest, SOURCES) or not within(cache_dir, CACHE):
        print("错误: 目标路径校验失败", file=sys.stderr)
        return 1

    print("取全文: 先尝试 HTML 版")
    html = fetch_html(arxiv_id)
    if html is not None:
        print("全文来源: arXiv HTML 版")
        anchors = anchors_from_html(html)
        fulltext = _strip_tags(html)
    else:
        print("HTML 版不可用，回退到 PDF 版")
        pdf_text = fetch_pdf_text(arxiv_id)
        if pdf_text is None:
            print("错误: HTML 和 PDF 版全文都取不到", file=sys.stderr)
            return 1
        anchors = anchors_from_pdf_text(pdf_text)
        fulltext = pdf_text

    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_path = cache_dir / "paper.md"
    cache_path.write_text(fulltext, encoding="utf-8")
    print(f"全文缓存: {cache_path}")

    wrote_meta = write_meta_yaml(dest, meta)
    wrote_anchors = write_anchors_md(dest, meta["title"], anchors)

    missing = self_check_anchors(dest / "anchors.md", fulltext)
    if missing:
        print(
            "错误: 自检失败，以下锚点在全文缓存里找不到逐字匹配: " + ", ".join(missing),
            file=sys.stderr,
        )
        return 1

    if not wrote_meta and not wrote_anchors:
        print("no new anchors")
    else:
        print(f"完成: {dest}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
