#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "pyyaml", "trafilatura"]
# ///
"""摄取一篇技术或产品 blog：用 trafilatura 抽正文（Markdown）和元数据，生成
`sources/blogs/<org>/<YYYYMMDD>-<slug>/{meta.yaml,anchors.md}`，全文缓存到
`.cache/blogs/<org>/<YYYYMMDD>-<slug>/article.md`（spec CLAUDE.md
"录入流程"）。

用法:
    uv run scripts/fetch_blog.py <url> --org <slug>
    uv run scripts/fetch_blog.py <url> --org <slug> --date 2026-09-18   # 元数据取不到发布日期时必填

网络（Task 17 binding decisions）:
    - 普通 requests.get，通用 User-Agent `agent-llm-wiki-fetch/1.0`，超时
      30s，5xx/超时各重试一次（等待 3s）。
    - trafilatura 用 `output_format='markdown'`、`include_links=True`、
      `with_metadata=True` 抽取正文和标题/作者/日期元数据。

`sources/` 只增不改：meta.yaml 已存在时不覆盖（字段不同则警告，不改动）；
anchors.md 只允许追加（复用 `fetch_paper.write_anchors_md`/`merge_anchors`
的 append-only 合并逻辑）。

`meta.yaml` 用 PyYAML `safe_dump(allow_unicode=True, sort_keys=False)`
渲染（同 `fetch_paper.py` 的选择：见该文件模块文档）。

标题文本（`##` 标题）在进 anchors.md 和 `.cache` 全文前都会先去掉
Markdown 强调/行内代码标记（`**`、`__`、`*`、`_`、`` ` ``）和链接语法
`[text](url)` → `text`（fix round 1, item 3），再写完 anchors.md 后同
`fetch_paper.py` 一样跑 `self_check_anchors` 自检。
"""

from __future__ import annotations

import argparse
import re
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from lib.transcribe import validate_safe_id, within  # noqa: E402
from fetch_paper import self_check_anchors, write_anchors_md, write_meta_yaml  # noqa: E402

SOURCES = ROOT / "sources"
CACHE = ROOT / ".cache"

USER_AGENT = "agent-llm-wiki-fetch/1.0"
REQUEST_TIMEOUT = 30
RETRY_SLEEP = 3.0

HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$")

# termSlug rule (site/src/lib/content-index.ts `termSlug`, ported):
# lowercase, collapse runs of non [a-z0-9] into '-', trim leading/trailing
# '-'. Used here on the blog title, then truncated to 60 chars per the
# brief, trimming any trailing '-' left by the cut.
_SLUG_COLLAPSE_RE = re.compile(r"[^a-z0-9]+")
_ASCII_ALNUM_RE = re.compile(r"[a-zA-Z0-9]")
SLUG_MAX_CHARS = 60


def term_slug(term: str) -> str:
    """Port of the TS `termSlug`: lowercase, runs of non-[a-z0-9] -> '-',
    trim leading/trailing '-'.
    """
    slug = _SLUG_COLLAPSE_RE.sub("-", term.lower())
    return slug.strip("-")


# Markdown inline-emphasis/code wrappers and link syntax to strip from a
# heading's text before it's written to anchors.md or the cached full
# text (fix round 1, item 3) — trafilatura's markdown output renders a
# heading like `### **Evidence from the outside world**` or
# `### [Linked Title](url)`, neither of which is the heading's plain
# text and both of which would otherwise leak into anchors.md and fail
# to verbatim-match a `.cache` full text that's normalized the same way.
_MD_LINK_RE = re.compile(r"\[([^\]]*)\]\([^)]*\)")
_MD_EMPHASIS_RE = re.compile(r"(\*\*|__|\*|_|`)")


def strip_markdown_emphasis(text: str) -> str:
    """Plain text of a Markdown heading/title: `[text](url)` -> `text`,
    then drop bare `**`/`__`/`*`/`_`/backtick wrapper characters (not a
    full Markdown parse — just the emphasis/code/link forms trafilatura
    produces for headings — so e.g. `**Evidence from the outside
    world**` -> `Evidence from the outside world`).
    """
    text = _MD_LINK_RE.sub(r"\1", text)
    text = _MD_EMPHASIS_RE.sub("", text)
    return text.strip()


def slugify_title(title: str, fallback_url: str) -> str:
    """Slug for a blog post directory name: `termSlug(title)` truncated
    to 60 chars (trailing '-' left by the cut is trimmed). If `title` has
    no ASCII letters/digits at all (e.g. a Chinese-only title), falls back
    to the last non-empty path segment of `fallback_url`, slugified the
    same way; if that's also empty, falls back to the literal `post`.
    """
    if _ASCII_ALNUM_RE.search(title):
        slug = term_slug(title)[:SLUG_MAX_CHARS].rstrip("-")
        if slug:
            return slug

    from urllib.parse import urlparse

    segments = [s for s in urlparse(fallback_url).path.split("/") if s]
    if segments:
        url_slug = term_slug(segments[-1])[:SLUG_MAX_CHARS].rstrip("-")
        if url_slug:
            return url_slug

    return "post"


def _get(url: str) -> "requests.Response | None":
    """GET `url` with the shared User-Agent, timeout, and one retry on
    5xx or timeout (after a 3s sleep). Mirrors `fetch_paper._get` minus
    the arXiv-etiquette throttle (not an arXiv endpoint).
    """
    headers = {"User-Agent": USER_AGENT}
    for attempt in range(2):
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


def number_blog(md: str) -> tuple[str, list[str]]:
    """Number a blog article's Markdown body by section and paragraph.

    Content before the first `##` heading is §0; each `##` heading in
    turn becomes §1, §2, …  (regardless of its original level — a blog's
    extracted Markdown may use `##`/`###` inconsistently, but the brief
    numbers every top-level-looking section in document order). Within
    each section, paragraphs (blank-line-separated blocks that are not
    themselves heading lines) are numbered ¶1, ¶2, … in order, and each
    paragraph's first line is prefixed with `§n¶m `.

    Heading text is passed through `strip_markdown_emphasis` before
    being used (fix round 1, item 3): trafilatura renders a blog's
    heading as e.g. `### **Evidence from the outside world**`, and a
    `##`/`###` heading line in the numbered output and in `anchors.md`
    must carry the plain title, not the `**`-wrapped Markdown source —
    otherwise `anchors.md`'s title can never verbatim-match the (equally
    de-emphasized) cached full text.

    Returns `(numbered_text, anchors)` where `anchors` holds one
    `## §n <heading text>` line per section (not §0, which has no
    heading), in order.
    """
    lines = md.split("\n")

    # Group lines into (heading_text_or_None, body_lines) per section, in
    # document order. The first group (before any heading) has
    # heading_text_or_None = None and is §0.
    sections: list[tuple[str | None, list[str]]] = []
    current_heading: str | None = None
    current_body: list[str] = []
    started = False

    for line in lines:
        heading_match = HEADING_RE.match(line)
        if heading_match:
            if started or current_body:
                sections.append((current_heading, current_body))
            current_heading = strip_markdown_emphasis(heading_match.group(2))
            current_body = []
            started = True
        else:
            current_body.append(line)
    sections.append((current_heading, current_body))

    anchors: list[str] = []
    out_lines: list[str] = []
    section_num = 0

    for heading, body in sections:
        if heading is not None:
            section_num += 1
            anchors.append(f"## §{section_num} {heading}")
            out_lines.append(f"## {heading}")

        paragraphs = [p.strip("\n") for p in re.split(r"\n\s*\n", "\n".join(body)) if p.strip() != ""]
        for para_num, para in enumerate(paragraphs, start=1):
            para_lines = para.split("\n")
            prefix = f"§{section_num}¶{para_num} "
            para_lines[0] = prefix + para_lines[0]
            out_lines.append("\n".join(para_lines))
            out_lines.append("")  # blank line between paragraphs

    numbered_text = "\n".join(out_lines).rstrip("\n") + "\n"
    return numbered_text, anchors


def fetch_article(url: str) -> dict:
    """Fetch `url` and extract its article body + metadata via
    trafilatura. Returns `{markdown, title, author, date}` (`date` is
    trafilatura's best-guess ISO date string, possibly empty).
    """
    import trafilatura

    resp = _get(url)
    if resp is None or resp.status_code != 200:
        raise RuntimeError(f"抓取失败: {url}（HTTP {resp.status_code if resp else '无响应'}）")

    doc = trafilatura.bare_extraction(
        resp.text, url=url, with_metadata=True, as_dict=False, output_format="markdown"
    )
    if doc is None:
        raise RuntimeError(f"trafilatura 未能从页面抽出正文: {url}")

    markdown = trafilatura.extract(
        resp.text,
        url=url,
        output_format="markdown",
        include_links=True,
        with_metadata=True,
    )
    if markdown is None:
        raise RuntimeError(f"trafilatura 未能从页面抽出正文: {url}")

    # Strip trafilatura's own `---\n...\n---\n` metadata header — we use
    # our own meta.yaml, not this one, and don't want it numbered as §0.
    if markdown.startswith("---\n"):
        end = markdown.find("\n---\n", 4)
        if end != -1:
            markdown = markdown[end + len("\n---\n") :].lstrip("\n")

    return {
        "markdown": markdown,
        "title": doc.title or "",
        "author": doc.author or "",
        "date": doc.date or "",
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("url", help="blog 文章 URL")
    ap.add_argument("--org", required=True, help="机构 slug，用作目录名")
    ap.add_argument("--date", default=None, help="发布日期 YYYY-MM-DD（元数据取不到时必填）")
    args = ap.parse_args(argv)

    try:
        org = validate_safe_id(args.org, "--org")
    except ValueError as e:
        print(f"错误: {e}", file=sys.stderr)
        return 2

    print(f"抓取: {args.url}")
    try:
        article = fetch_article(args.url)
    except RuntimeError as e:
        print(f"错误: {e}", file=sys.stderr)
        return 1

    date_str = article["date"] or args.date
    if not date_str:
        print(
            "错误: 页面元数据中没有发布日期，请加 --date YYYY-MM-DD 指定",
            file=sys.stderr,
        )
        return 2
    date_compact = re.sub(r"-", "", date_str[:10])
    if len(date_compact) != 8 or not date_compact.isdigit():
        print(f"错误: 无法解析日期为 YYYYMMDD: {date_str!r}", file=sys.stderr)
        return 2

    title = article["title"] or "untitled"
    slug = slugify_title(title, fallback_url=args.url)

    dest = SOURCES / "blogs" / org / f"{date_compact}-{slug}"
    cache_dir = CACHE / "blogs" / org / f"{date_compact}-{slug}"
    if not within(dest, SOURCES) or not within(cache_dir, CACHE):
        print("错误: 目标路径校验失败", file=sys.stderr)
        return 1

    numbered_text, anchors = number_blog(article["markdown"])

    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_path = cache_dir / "article.md"
    cache_path.write_text(numbered_text, encoding="utf-8")
    print(f"全文缓存: {cache_path}")

    meta = {
        "title": title,
        "author": article["author"],
        "url": args.url,
        "org": org,
        "date": date_str[:10],
        "fetched": time.strftime("%Y-%m-%d"),
    }
    wrote_meta = write_meta_yaml(dest, meta)
    wrote_anchors = write_anchors_md(dest, title, anchors)

    missing = self_check_anchors(dest / "anchors.md", numbered_text)
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
