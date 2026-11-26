#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["yt-dlp[default]>=2026.8"]
# ///
"""摄取单个视频：抓元数据 + 字幕（或转录），生成
`sources/videos/<channel>/<YYYYMMDD>-<id>/transcript.md`（spec CLAUDE.md
"录入流程"）。B 站视频的 `<id>` 用 BV 号。

用法:
    uv run scripts/fetch_video.py <video-url> --channel <slug>
    uv run scripts/fetch_video.py <video-url> --channel <slug> --lang zh
    # 无字幕时下载音频并本地转录（macOS arm64 默认用 mlx-whisper）:
    uv run --with mlx-whisper scripts/fetch_video.py <url> --channel <slug> --transcribe
    # Linux / CUDA 默认用 faster-whisper:
    uv run --with faster-whisper scripts/fetch_video.py <url> --channel <slug> --transcribe
    # 强制指定引擎:
    uv run --with mlx-whisper scripts/fetch_video.py <url> --channel <slug> --transcribe --engine mlx
    # 覆盖一份从未提交过的 transcript.md:
    uv run scripts/fetch_video.py <url> --channel <slug> --force

依赖:
    yt-dlp 已声明为脚本内联依赖，uv run 会自动装好。
    mlx-whisper / faster-whisper 只有 --transcribe 需要，按需用 --with 注入
    （见 scripts/lib/transcribe.py 模块文档）。
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from lib.transcribe import (  # noqa: E402
    DEFAULT_MODEL,
    drop_trailing_hallucination,
    format_anchored,
    transcribe,
    write_transcript,
)

SOURCES = ROOT / "sources"
AUDIO_CACHE = ROOT / ".cache" / "audio"

# 字幕语言偏好：CC 字幕优先简体中文及其常见自动字幕变体
ZH_SUB_PREF = ["zh-Hans", "zh-CN", "zh", "ai-zh"]


def run(cmd: list[str], timeout: int | None = None) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        sys.exit(f"命令超时（{timeout}s）: {' '.join(cmd[:2])} …")


def _ytdlp() -> list[str]:
    """yt-dlp 的公共命令前缀（同 ai-kol-wiki/scripts/fetch.py 的 _ytdlp）。"""
    cmd = ["yt-dlp"]
    if shutil.which("node"):
        cmd += ["--js-runtimes", "node"]
    cmd += ["--extractor-args", "youtube:player_client=visionos,default"]
    return cmd


def pick_sub_lang(available: dict, pref: list[str]) -> str | None:
    for lang in pref:
        if lang in available:
            return lang
    for lang in available:
        if lang.startswith("zh"):
            return lang
    return None


def parse_vtt(path: Path, anchor_every: int = 60) -> str:
    """VTT -> 带 [HH:MM:SS] 锚点的纯文本（同 ai-kol-wiki/scripts/fetch.py 的 parse_vtt）。"""
    ts_re = re.compile(r"(\d+):(\d+):(\d+)\.\d+\s*-->")
    tag_re = re.compile(r"<[^>]+>")
    out: list[str] = []
    last_line = ""
    cur_time = 0.0
    next_anchor = 0.0
    for raw in path.read_text(encoding="utf-8").splitlines():
        m = ts_re.match(raw.strip())
        if m:
            h, mi, s = map(int, m.groups())
            cur_time = h * 3600 + mi * 60 + s
            continue
        line = tag_re.sub("", raw).strip()
        if not line or line == "WEBVTT" or line.startswith(("Kind:", "Language:", "NOTE")):
            continue
        if line == last_line:
            continue
        if cur_time >= next_anchor:
            out.append(f"\n[{cur_time // 3600:02.0f}:{cur_time % 3600 // 60:02.0f}:{cur_time % 60:02.0f}]")
            next_anchor = cur_time + anchor_every
        out.append(line)
        last_line = line
    return " ".join(out).replace(" \n", "\n").strip()


def audio_files(d: Path) -> list[Path]:
    return [p for p in d.glob("audio.*") if p.suffix not in (".md", ".part", ".ytdl")]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("url", help="视频 URL")
    ap.add_argument("--channel", required=True, help="UP 主 / 频道 slug，用作目录名")
    ap.add_argument("--transcribe", action="store_true", help="无字幕时下载音频并本地转录")
    ap.add_argument("--lang", default="zh", help="转录/字幕偏好语言（默认 zh）")
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

    print(f"抓取元数据: {args.url}")
    r = run(_ytdlp() + ["-J", "--no-playlist", args.url], timeout=120)
    if r.returncode != 0:
        sys.exit(f"yt-dlp 失败:\n{r.stderr[-2000:]}")
    info = json.loads(r.stdout)

    vid = info["id"]  # B 站: BV 号
    upload = info.get("upload_date") or date.today().strftime("%Y%m%d")
    dest = SOURCES / "videos" / args.channel / f"{upload}-{vid}"

    subs = info.get("subtitles") or {}
    autos = info.get("automatic_captions") or {}
    lang = pick_sub_lang(subs, ZH_SUB_PREF)
    auto = False
    if lang is None:
        lang = pick_sub_lang(autos, ZH_SUB_PREF)
        auto = True

    title = info.get("title", "")
    url = info.get("webpage_url", args.url)
    duration_minutes = round((info.get("duration") or 0) / 60)
    meta_base = {
        "title": title,
        "url": url,
        "channel": args.channel,
        "upload_date": upload,
        "duration_minutes": duration_minutes,
        "fetched": date.today().isoformat(),
    }

    if lang is not None:
        # ── 有 CC 字幕路径 ──
        kind = "自动" if auto else "人工"
        print(f"下载字幕: {lang}（{kind}）")
        with tempfile.TemporaryDirectory() as tmp:
            cmd = _ytdlp() + [
                "--no-playlist",
                "--skip-download",
                "--sub-langs",
                lang,
                "--sub-format",
                "vtt",
                "--write-auto-subs" if auto else "--write-subs",
                "-o",
                f"{tmp}/sub",
                args.url,
            ]
            r = run(cmd, timeout=300)
            vtts = list(Path(tmp).glob("*.vtt"))
            if not vtts:
                sys.exit(f"字幕下载失败:\n{r.stderr[-2000:]}")
            text = parse_vtt(vtts[0])

        meta = {**meta_base, "subtitle": f"{lang} ({kind})"}
        out_path = write_transcript(
            dest, meta, text, seen_txt=SOURCES / "seen.txt", item_id=vid, force=args.force
        )
        print(f"完成: {out_path}")
        return

    if not args.transcribe:
        sys.exit(f"没有可用 CC 字幕。可加 --transcribe 下载音频并本地转录。")

    # ── 无字幕，--transcribe 路径 ──
    AUDIO_CACHE.mkdir(parents=True, exist_ok=True)
    audio_dir = AUDIO_CACHE / f"{args.channel}-{upload}-{vid}"
    audio_dir.mkdir(parents=True, exist_ok=True)
    print("下载音频...")
    r2 = run(
        _ytdlp()
        + ["--no-playlist", "-f", "bestaudio/best", "-o", str(audio_dir / "audio.%(ext)s"), args.url],
        timeout=1800,
    )
    if r2.returncode != 0:
        sys.exit(f"音频下载失败:\n{r2.stderr[-2000:]}")
    found = audio_files(audio_dir)
    if not found:
        sys.exit(f"音频文件未生成于 {audio_dir}")
    audio_path = found[0]

    orig = info.get("language") or ""
    transcribe_lang = orig if orig.startswith(("zh", "en")) else args.lang

    segs = transcribe(
        audio_path,
        model=args.whisper_model,
        lang=transcribe_lang,
        device=args.device,
        engine=args.engine,
    )
    segs = drop_trailing_hallucination(segs)
    text = format_anchored(segs)

    resolved_engine = args.engine
    if resolved_engine == "auto":
        import platform as _platform

        resolved_engine = "mlx" if sys.platform == "darwin" and _platform.machine() == "arm64" else "faster"
    subtitle = f"{transcribe_lang} ({resolved_engine}-whisper {args.whisper_model}) 未校对"

    meta = {**meta_base, "subtitle": subtitle}
    out_path = write_transcript(
        dest, meta, text, seen_txt=SOURCES / "seen.txt", item_id=vid, force=args.force
    )
    print(f"完成: {out_path}")

    if not args.keep_audio:
        shutil.rmtree(audio_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
