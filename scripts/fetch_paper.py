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
import html as html_lib
import re
import sys
import time
from html.parser import HTMLParser
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
    # Decode character references (`&amp;` → `&`) once, after tags are
    # gone, so the cached full text reads like the paper does (task-23b).
    text = html_lib.unescape(text)
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


SECTION_LEVEL_CLASS_RE = re.compile(r"\bltx_title_(section|subsection|subsubsection)\b")
TAG_LABEL_CLASS_RE = re.compile(r"\bltx_tag\b")
TARGET_FIGURE_CLASS_RE = re.compile(r"\bltx_(?:figure|table)\b")
FIGTAB_LABEL_RE = re.compile(r"^(Fig(?:ure)?|Tab(?:le)?)\.?\s*(\d+)\s*[:.]?$")


class _HTMLAnchorWalker(HTMLParser):
    """Tag-aware walker for arXiv's LaTeXML HTML, replacing the previous
    regex-only `anchors_from_html` (which matched one fixed markup shape per
    anchor kind and missed every real-world variant: nested `<span>`s
    around the tag number, `Figure N.`/`Fig.` label spellings, captions
    living in `<figure class="ltx_figure_panel">` wrappers, and several
    `<figcaption>`s sharing one outer `<figure>` for an inline subfigure
    group — see fix round 2 / task-23_5).

    Walks the document with an explicit open-tag stack. Each stack frame
    records enough for `handle_endtag` to decide, at close time, whether it
    closed:

    - a numbered heading (`<h1>`–`<h6> class="ltx_title ltx_title_section
      |subsection|subsubsection">`): its direct text is split into *label*
      (text inside the nearest descendant `<span class="ltx_tag ...">`,
      at any nesting depth — Defect 2's "nested `<span>` in section
      titles" generalised) and *title* (everything else at any depth);
    - a `<figure>`/`<table>` whose `class` contains `ltx_figure` or
      `ltx_table` (a "target" figure, regardless of what other classes —
      `ltx_figure_panel`, `ltx_align_*`, … — it also carries, since those
      vary across papers and are not diagnostic of whether a caption is
      numbered): each direct `<figcaption>` found anywhere inside it
      *except inside a nested target figure* (a subfigure panel) is
      recorded, label vs. rest split the same way as headings. A single
      outer `<figure>` can hold more than one direct `<figcaption>` when
      LaTeXML renders a `{subfigure}` group inline instead of as nested
      `<figure>`s (e.g. arXiv 2609.37725's Figures 6/7/8 under one
      `<figure id="S5.F8">`); each becomes its own anchor candidate.

    Classification of a caption as a figure or a table is done from its
    *label word* ("Figure"/"Fig."/"Table"/"Tab.") rather than from the
    outer tag's class or the tag-span's own class — arXiv is inconsistent
    about labelling an actual table's tag span `ltx_tag_figure` instead of
    `ltx_tag_table` (task-19_5's original finding), and this generalises
    that fix to the walker. A caption whose label doesn't parse as one of
    those four forms (e.g. a subfigure panel's bare `(a)`/`(b)`) is not a
    numbered figure/table and is dropped, which is how "skip subfigure
    panels without their own number" (brief R) falls out naturally rather
    than needing a separate panel-detection rule.
    """

    VOID_TAGS = frozenset(
        {
            "area", "base", "br", "col", "embed", "hr", "img", "input",
            "link", "meta", "param", "source", "track", "wbr",
        }
    )

    def __init__(self) -> None:
        # convert_charrefs=False plus the raw-markup handlers below: the
        # parts collected for a heading/caption are the *source HTML* of
        # that span (tags, entities and all), so `_strip_tags` renders a
        # caption exactly as it renders the same bytes inside the cached
        # full text (`_strip_tags(whole_html)`). Collecting decoded text
        # instead dropped the tag-boundary spaces ("Figure 2 ." in the
        # full text vs "Figure 2." in the caption), skipped the MathML
        # alttext substitution ("1/τ1/\tau" vs "1/\tau"), and decoded
        # `&amp;` on one side only — task-23b, arXiv 2307.03172/2310.05736.
        super().__init__(convert_charrefs=False)
        self.stack: list[dict] = []
        self.sections: list[tuple[str, str, str]] = []  # (classes, label_html, title_html)
        self.figures: list[tuple[str, str]] = []  # (label_html, rest_html)

    def _append_raw(self, raw: str) -> None:
        kind, frame, in_label = self._current_target()
        if kind == "figcaption":
            frame["cap_parts"].append((in_label, raw))
        elif kind == "heading":
            (frame["label_parts"] if in_label else frame["title_parts"]).append(raw)

    def _enclosing_target_figure(self) -> dict | None:
        for frame in reversed(self.stack):
            if frame.get("is_target_figure"):
                return frame
        return None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        cls = dict(attrs).get("class") or ""
        frame: dict = {"tag": tag, "classes": cls}

        frame["is_heading"] = bool(
            re.match(r"h[1-6]$", tag) and SECTION_LEVEL_CLASS_RE.search(cls)
        )
        if frame["is_heading"]:
            frame["label_parts"] = []
            frame["title_parts"] = []

        is_target = tag in ("figure", "table") and bool(TARGET_FIGURE_CLASS_RE.search(cls))
        frame["is_target_figure"] = is_target
        if is_target:
            frame["figcaptions_raw"] = []

        frame["is_figcaption"] = tag == "figcaption"
        if frame["is_figcaption"]:
            frame["cap_parts"] = []

        frame["is_tag_label_span"] = tag == "span" and bool(TAG_LABEL_CLASS_RE.search(cls))

        if tag not in self.VOID_TAGS:
            self.stack.append(frame)
        self._append_raw(self.get_starttag_text() or "")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._append_raw(self.get_starttag_text() or "")

    def handle_entityref(self, name: str) -> None:
        self._append_raw(f"&{name};")

    def handle_charref(self, name: str) -> None:
        self._append_raw(f"&#{name};")

    def _current_target(self) -> tuple[str | None, dict | None, bool]:
        """The innermost open heading or figcaption frame (figcaption takes
        priority — headings never nest inside figcaptions in this markup),
        plus whether the parser is currently inside a descendant
        `ltx_tag` label span of that frame.
        """
        heading_frame = None
        figcaption_frame = None
        in_label = False
        for frame in self.stack:
            if frame.get("is_heading"):
                heading_frame = frame
                in_label = False
            elif frame.get("is_figcaption"):
                figcaption_frame = frame
                heading_frame = None
                in_label = False
            if frame.get("is_tag_label_span") and (heading_frame is not None or figcaption_frame is not None):
                in_label = True
        if figcaption_frame is not None:
            return "figcaption", figcaption_frame, in_label
        if heading_frame is not None:
            return "heading", heading_frame, in_label
        return None, None, False

    def handle_data(self, data: str) -> None:
        self._append_raw(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in self.VOID_TAGS:
            return
        idx = None
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i]["tag"] == tag:
                idx = i
                break
        if idx is None:
            return  # unmatched close tag — ignore rather than corrupt the stack
        self._append_raw(f"</{tag}>")
        frame = self.stack[idx]

        if frame.get("is_figcaption"):
            # Attribute this figcaption to its nearest enclosing <figure>/
            # <table>, but only if that ancestor is itself a target figure
            # (not, e.g., some other wrapper) — a nested *target* figure
            # (a subfigure panel) is its own owner, so its figcaption never
            # attaches to the outer one.
            owner = None
            for i in range(idx - 1, -1, -1):
                if self.stack[i]["tag"] in ("figure", "table"):
                    if self.stack[i].get("is_target_figure"):
                        owner = self.stack[i]
                    break
            if owner is not None:
                label_html = "".join(text for is_label, text in frame["cap_parts"] if is_label)
                rest_html = "".join(text for is_label, text in frame["cap_parts"] if not is_label)
                owner["figcaptions_raw"].append((label_html, rest_html))

        if frame.get("is_heading"):
            self.sections.append(
                (frame["classes"], "".join(frame["label_parts"]), "".join(frame["title_parts"]))
            )

        if frame.get("is_target_figure"):
            for label_html, rest_html in frame["figcaptions_raw"]:
                self.figures.append((label_html, rest_html))

        del self.stack[idx:]


def anchors_from_html(html: str) -> list[str]:
    """Extract anchor lines from arXiv's LaTeXML HTML rendering via a
    tag-aware walk (`_HTMLAnchorWalker`) rather than fixed-shape regexes:
    numbered section/subsection/subsubsection headings become
    `## §<num> <title>`; figure captions become `- Fig. <n> — <desc>`
    (desc truncated to 120 chars); table captions become
    `- Tab. <n> — <desc>` likewise. Output order is sections (in document
    order), then figures (in document order), then tables (in document
    order) — matching the previous implementation's grouping, which
    `merge_anchors`'s append-only dedup and every committed `anchors.md`
    already rely on.

    Appendix sections (`ltx_title_appendix`, ids like "A", "A.1") are
    deliberately skipped: the shared `§` grammar in `lib/anchors.py` only
    recognises `\\d+(\\.\\d+)*` keys, and extending it is out of scope
    (Task 17 binding decisions) — so appendix headings produce no anchor
    line at all, section numbering falls through to the next numeric
    heading unaffected. A subfigure panel's caption (e.g. `(a)`, `(b)`)
    produces no anchor either, since its label doesn't parse as
    `Figure N`/`Fig. N`/`Table N`/`Tab. N` (brief R: "skip subfigure panels
    without their own number").
    """
    walker = _HTMLAnchorWalker()
    walker.feed(html)

    anchors: list[str] = []

    for _classes, label_html, title_html in walker.sections:
        label = _strip_tags(label_html).strip()
        num = label.rstrip(". ").strip()
        if not NUMERIC_SECTION_RE.match(num):
            continue  # appendix id (e.g. "A", "A.1") — skip per binding decisions
        title = _strip_tags(title_html).strip(" .")
        if title:
            anchors.append(f"## §{num} {title}")

    figs: list[str] = []
    tabs: list[str] = []
    for label_html, rest_html in walker.figures:
        label_text = _strip_tags(label_html).strip()
        match = FIGTAB_LABEL_RE.match(label_text)
        if not match:
            continue  # unnumbered subfigure panel caption, e.g. "(a)"
        word, n = match.group(1), match.group(2)
        desc = _truncate(_strip_tags(rest_html), CAPTION_MAX_CHARS)
        if not desc:
            continue
        if word.startswith("Tab"):
            tabs.append(f"- Tab. {n} — {desc}")
        else:
            figs.append(f"- Fig. {n} — {desc}")

    anchors.extend(figs)
    anchors.extend(tabs)
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
