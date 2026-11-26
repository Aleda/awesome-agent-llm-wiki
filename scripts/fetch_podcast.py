#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["requests"]
# ///
"""摄取小宇宙单集：抓页面数据 + 下载音频 + 本地转录，生成
`sources/podcasts/<show>/<YYYYMMDD>-<eid>/transcript.md`（spec CLAUDE.md
"录入流程"）。

小宇宙页面没有公开 API，单集数据嵌在页面的
`<script id="__NEXT_DATA__">` 里（`props.pageProps.episode`），yt-dlp 不
支持，故自己写页面解析和音频下载。

用法:
    uv run --with mlx-whisper scripts/fetch_podcast.py <episode-url> --show <slug>
    uv run --with faster-whisper scripts/fetch_podcast.py <episode-url> --show <slug> --engine faster
    uv run --with mlx-whisper scripts/fetch_podcast.py <episode-url> --show <slug> --force

依赖:
    requests 用于下载页面和音频（声明为内联依赖）。
    mlx-whisper / faster-whisper 按需用 --with 注入，见
    scripts/lib/transcribe.py 模块文档。
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from datetime import date, datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from lib.transcribe import (  # noqa: E402
    DEFAULT_MODEL,
    drop_trailing_hallucination,
    format_anchored,
    transcribe,
    validate_safe_id,
    write_transcript,
)

SOURCES = ROOT / "sources"
AUDIO_CACHE = ROOT / ".cache" / "audio"

NEXT_DATA_RE = re.compile(
    r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.S
)

# 通用浏览器 UA，不带任何个人信息，仅用于避开反爬的 UA 黑名单。
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

_BLOCK_TAGS = {"p", "br", "li", "div", "figure"}
_SKIP_TAGS = {"script", "style", "noscript", "template"}
_COLLAPSE_BLANK_LINES_RE = re.compile(r"\n{3,}")


class _ShownotesToText(HTMLParser):
    """Converts shownotes HTML to plain text (Ruling R24): strips tags,
    turns block-level tags (`<p>`, `<br>`, `<li>`, ...) into newlines,
    unescapes entities (handled by `HTMLParser` itself via
    `convert_charrefs=True`), renders `<a href="url">text</a>` as
    `text (url)` when `text != url` (and just `url` when they match, or
    when there's no link text), drops `<img>` entirely (no alt-text
    placeholder — an image conveys nothing as plain text here), and
    discards the raw content of `<script>`/`<style>`/`<noscript>`/
    `<template>` entirely rather than inlining it as text (fix round 2).
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._parts: list[str] = []
        self._link_href: str | None = None
        self._link_text_parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in _SKIP_TAGS:
            self._skip_depth += 1
            return
        if self._skip_depth > 0:
            return
        if tag in _BLOCK_TAGS:
            self._parts.append("\n")
        if tag == "a":
            href = dict(attrs).get("href")
            self._link_href = href
            self._link_text_parts = []

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if self._skip_depth > 0:
            return
        if tag in _BLOCK_TAGS:
            self._parts.append("\n")
        # self-closing <img/> etc: nothing else to do, image dropped.

    def handle_endtag(self, tag: str) -> None:
        if tag in _SKIP_TAGS:
            self._skip_depth = max(0, self._skip_depth - 1)
            return
        if self._skip_depth > 0:
            return
        if tag in _BLOCK_TAGS:
            self._parts.append("\n")
        if tag == "a":
            text = "".join(self._link_text_parts).strip()
            href = self._link_href
            if href:
                self._parts.append(f"{text} ({href})" if text and text != href else href)
            else:
                self._parts.append(text)
            self._link_href = None
            self._link_text_parts = []

    def handle_data(self, data: str) -> None:
        if self._skip_depth > 0:
            return
        if self._link_href is not None:
            self._link_text_parts.append(data)
        else:
            self._parts.append(data)

    def get_text(self) -> str:
        text = "".join(self._parts)
        text = _COLLAPSE_BLANK_LINES_RE.sub("\n\n", text)
        return text.strip()


def shownotes_html_to_text(html: str) -> str:
    """Plain-text rendering of shownotes HTML — see `_ShownotesToText`.
    Uses only stdlib `html.parser` (no new dependency).
    """
    parser = _ShownotesToText()
    parser.feed(html)
    parser.close()
    return parser.get_text()


def parse_episode(html: str) -> dict:
    """从小宇宙单集页面 HTML 中解析出单集数据。

    返回 `{eid, title, show_title, audio_url, pub_date, duration_minutes,
    description}`；`pub_date` 格式为 `YYYYMMDD`。

    找不到 `__NEXT_DATA__` 或音频地址时抛 `ValueError`，信息里说明缺的
    是哪一项。
    """
    m = NEXT_DATA_RE.search(html)
    if not m:
        raise ValueError("页面中找不到 __NEXT_DATA__ 脚本标签，无法解析单集数据")

    try:
        data = json.loads(m.group(1))
    except json.JSONDecodeError as e:
        raise ValueError(f"__NEXT_DATA__ 内容不是合法 JSON: {e}")

    try:
        episode = data["props"]["pageProps"]["episode"]
    except (KeyError, TypeError):
        raise ValueError("__NEXT_DATA__ 中找不到 props.pageProps.episode")

    audio_url = (
        episode.get("enclosure", {}).get("url")
        or episode.get("media", {}).get("source", {}).get("url")
    )
    if not audio_url:
        raise ValueError("单集数据中找不到音频地址（enclosure.url / media.source.url）")

    pub_date_raw = episode.get("pubDate")
    if not pub_date_raw:
        raise ValueError("单集数据中找不到 pubDate")
    pub_date = datetime.fromisoformat(pub_date_raw.replace("Z", "+00:00")).strftime("%Y%m%d")

    duration_seconds = episode.get("duration") or 0
    duration_minutes = round(duration_seconds / 60)

    show_title = episode.get("podcast", {}).get("title", "")

    # shownotes 是 HTML（可能带 <p>/<img> 标签），description 是纯文本摘要；
    # frontmatter 的 description 字段优先用 shownotes（更完整），没有则退回
    # description；shownotes 需转成纯文本（Ruling R24），description 本身
    # 已是纯文本，原样保留。
    shownotes = episode.get("shownotes")
    description = shownotes_html_to_text(shownotes) if shownotes else episode.get("description") or ""

    return {
        "eid": episode.get("eid", ""),
        "title": episode.get("title", ""),
        "show_title": show_title,
        "audio_url": audio_url,
        "pub_date": pub_date,
        "duration_minutes": duration_minutes,
        "description": description,
    }


def download(url: str, dest: Path) -> None:
    import requests

    with requests.get(url, headers={"User-Agent": USER_AGENT}, stream=True, timeout=120) as r:
        r.raise_for_status()
        with dest.open("wb") as f:
            for chunk in r.iter_content(chunk_size=1 << 16):
                f.write(chunk)


def fetch_episode_page(url: str) -> str:
    import requests

    r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
    r.raise_for_status()
    return r.text


_AUDIO_EXT_RE = re.compile(r"^\.[a-z0-9]{2,6}$")


def audio_extension(url: str, default: str = ".m4a") -> str:
    """The audio file extension to save `url`'s download as: derived from
    `urlparse(url).path` (so a query string like `?token=...` doesn't
    leak into it), falling back to `default` when the path has no
    suffix or the suffix doesn't look like a plausible extension
    (`.` + 2-6 lowercase alphanumeric chars).
    """
    suffix = Path(urlparse(url).path).suffix.lower()
    return suffix if _AUDIO_EXT_RE.match(suffix) else default


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("url", help="小宇宙单集 URL")
    ap.add_argument("--show", required=True, help="节目 slug，用作目录名")
    ap.add_argument("--lang", default="zh", help="转录语言（默认 zh）")
    ap.add_argument(
        "--engine",
        default="auto",
        choices=["auto", "mlx", "faster"],
        help="转录引擎（默认 auto：macOS arm64 用 mlx，其余用 faster-whisper）",
    )
    ap.add_argument("--whisper-model", default=DEFAULT_MODEL, help=f"whisper 模型（默认 {DEFAULT_MODEL}）")
    ap.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda"], help="faster-whisper 推理设备")
    ap.add_argument("--keep-audio", action="store_true", help="转录成功后不删除下载的音频")
    ap.add_argument("--force", action="store_true", help="覆盖已存在的 transcript.md（只用于从未提交过的转录稿）")
    args = ap.parse_args()

    print(f"抓取页面: {args.url}")
    html = fetch_episode_page(args.url)
    ep = parse_episode(html)

    validate_safe_id(args.show, "--show")
    eid = validate_safe_id(ep["eid"], "episode eid")

    dest = SOURCES / "podcasts" / args.show / f"{ep['pub_date']}-{eid}"

    AUDIO_CACHE.mkdir(parents=True, exist_ok=True)
    audio_dir = AUDIO_CACHE / f"{args.show}-{ep['pub_date']}-{eid}"
    audio_dir.mkdir(parents=True, exist_ok=True)
    audio_path = audio_dir / f"audio{audio_extension(ep['audio_url'])}"
    print(f"下载音频: {ep['audio_url']}")
    download(ep["audio_url"], audio_path)

    segs = transcribe(
        audio_path,
        model=args.whisper_model,
        lang=args.lang,
        device=args.device,
        engine=args.engine,
    )
    segs = drop_trailing_hallucination(segs)
    text = format_anchored(segs)

    resolved_engine = args.engine
    if resolved_engine == "auto":
        import platform as _platform

        resolved_engine = "mlx" if sys.platform == "darwin" and _platform.machine() == "arm64" else "faster"
    subtitle = f"{args.lang} ({resolved_engine}-whisper {args.whisper_model}) 未校对"

    meta = {
        "title": ep["title"],
        "url": args.url,
        "show": args.show,
        "upload_date": ep["pub_date"],
        "duration_minutes": ep["duration_minutes"],
        "description": ep["description"],
        "subtitle": subtitle,
        "fetched": date.today().isoformat(),
    }
    out_path = write_transcript(
        dest, meta, text, seen_txt=SOURCES / "seen.txt", item_id=eid, force=args.force
    )
    print(f"完成: {out_path}")

    if not args.keep_audio:
        shutil.rmtree(audio_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
