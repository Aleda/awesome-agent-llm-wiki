"""Shared Whisper transcription library (Task 16; spec CLAUDE.md "录入流程").

Ported from `../ai-kol-wiki/scripts/fetch.py` (`transcribe_with_whisper`,
`_ensure_cuda_libs`, `fmt_ts`, `format_segments`, `_to_wav16k`), without
speaker diarization — that stays ai-kol-wiki specific for now. Used by
both `fetch_video.py` and `fetch_podcast.py`.

## Engines (Ruling R23)

Two engines, selected by `engine`:
- `mlx-whisper` — default on macOS arm64 (fast on Apple Silicon via MLX).
- `faster-whisper` — default elsewhere (and the only supported engine on
  Linux/CUDA).

Neither is declared in this script's PEP 723 dependencies (both are
heavy — mlx-whisper pulls in mlx, faster-whisper pulls in ctranslate2).
Callers inject the one they need:

    uv run --with mlx-whisper scripts/fetch_video.py <url> --channel <slug> --transcribe
    uv run --with faster-whisper scripts/fetch_video.py <url> --channel <slug> --transcribe

A missing engine raises a clear `RuntimeError` naming the right `--with`
flag rather than a bare `ImportError`.
"""

from __future__ import annotations

import importlib.util
import os
import platform
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

DEFAULT_MODEL = "large-v3-turbo"
MLX_MODEL_REPO = "mlx-community/whisper-large-v3-turbo"

# Slugs/ids used as path components (video id, podcast eid, --channel,
# --show) must match this — no path separators, no "..", no leading dot
# or dash. Fix round 1, item 3.
SAFE_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


def validate_safe_id(value: str, label: str) -> str:
    """Raise `ValueError` if `value` isn't safe to use as a single path
    component (used for video/podcast ids and `--channel`/`--show`
    slugs, which all end up in a `sources/...` destination path built
    from untrusted input — a video title, a CLI argument, or page data).
    Returns `value` unchanged when it passes.
    """
    if ".." in value or not SAFE_ID_RE.match(value):
        raise ValueError(
            f"{label} 不合法: {value!r}（只允许字母、数字、`.`、`_`、`-`，"
            "且不能包含 `..`，不能以非字母数字开头）"
        )
    return value


def within(path: Path, root: Path) -> bool:
    """Whether `path` (resolved) lies under `root` (resolved) — a
    containment check mirroring the TS `within()` helper, used as a
    last-line-of-defense against a sanitized-looking id that still
    escapes `sources/` (e.g. via a symlink).
    """
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False

# Chinese-biasing prompt (both engines) — see Task 16 Ruling R23.
INITIAL_PROMPT_ZH = "以下是普通话的句子，使用简体中文。"


def fmt_ts(seconds: float) -> str:
    """Seconds (float, truncated) -> `HH:MM:SS`."""
    s = int(seconds)
    return f"{s // 3600:02d}:{s % 3600 // 60:02d}:{s % 60:02d}"


def _default_engine() -> str:
    """`mlx-whisper` on macOS arm64, `faster-whisper` everywhere else."""
    if sys.platform == "darwin" and platform.machine() == "arm64":
        return "mlx"
    return "faster"


def _ensure_cuda_libs(device: str) -> None:
    """Let GPU transcription work inside a `uv` ephemeral environment.

    CTranslate2 (faster-whisper's backend) loads libcublas/libcudnn at
    process start via the dynamic linker, so their directories must be in
    `LD_LIBRARY_PATH` *before* that happens. If the caller injected the
    `nvidia-cublas-cu12` / `nvidia-cudnn-cu12` wheels (via `--with`), this
    locates their `lib/` dirs, adds them to `LD_LIBRARY_PATH`, and
    re-execs this process so the linker picks them up. No-op if those
    wheels aren't installed (GPU load failure then falls back to CPU) or
    if `device == "cpu"`.
    """
    if device == "cpu" or os.environ.get("_FETCH_CUDA_REEXEC"):
        return
    lib_dirs = []
    for pkg in ("nvidia.cublas", "nvidia.cudnn"):
        spec = importlib.util.find_spec(pkg)
        locs = getattr(spec, "submodule_search_locations", None) if spec else None
        if locs:
            d = Path(list(locs)[0]) / "lib"
            if d.is_dir():
                lib_dirs.append(str(d))
    if not lib_dirs:
        return
    current = os.environ.get("LD_LIBRARY_PATH", "")
    if all(d in current.split(":") for d in lib_dirs):
        return  # already present
    os.environ["LD_LIBRARY_PATH"] = ":".join(lib_dirs + ([current] if current else []))
    os.environ["_FETCH_CUDA_REEXEC"] = "1"
    os.execv(sys.executable, [sys.executable, *sys.argv])


def _transcribe_mlx(audio: Path, model: str, lang: str) -> list[tuple[float, float, str]]:
    try:
        import mlx_whisper
    except ImportError:
        raise RuntimeError(
            "引擎 mlx 需要 mlx-whisper，请用 --with 按需注入：\n"
            "  uv run --with mlx-whisper scripts/fetch_video.py <url> --channel <slug> --transcribe"
        )

    repo = MLX_MODEL_REPO if model == DEFAULT_MODEL else f"mlx-community/whisper-{model}"
    print(f"加载 mlx-whisper 模型: {repo}（首次运行会下载模型）")
    print(f"开始转录（引擎: mlx，语言: {lang}），请耐心等待...")
    result = mlx_whisper.transcribe(
        str(audio),
        path_or_hf_repo=repo,
        language=lang[:2],
        initial_prompt=INITIAL_PROMPT_ZH if lang.startswith("zh") else None,
    )
    return [(seg["start"], seg["end"], seg["text"]) for seg in result["segments"]]


def _transcribe_faster(
    audio: Path, model: str, lang: str, device: str
) -> list[tuple[float, float, str]]:
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        raise RuntimeError(
            "引擎 faster 需要 faster-whisper，请用 --with 按需注入：\n"
            "  uv run --with faster-whisper scripts/fetch_video.py <url> --channel <slug> --transcribe"
        )

    def transcribe_on(dev: str, compute_type: str) -> list[tuple[float, float, str]]:
        m = WhisperModel(model, device=dev, compute_type=compute_type)
        segments, _ = m.transcribe(
            str(audio),
            language=lang[:2],
            initial_prompt=INITIAL_PROMPT_ZH if lang.startswith("zh") else None,
        )
        return [(seg.start, seg.end, seg.text) for seg in segments]

    print(f"加载 faster-whisper 模型: {model}（首次运行会下载模型，约 1.5GB）")
    print(f"开始转录（设备: {device}，语言: {lang}），请耐心等待...")
    try:
        return transcribe_on(device, "auto" if device != "cpu" else "int8")
    except RuntimeError as e:
        if device != "cpu" and any(
            k in str(e).lower() for k in ("cuda", "cublas", "cudnn", "gpu", "libcu")
        ):
            print(f"GPU 不可用（{str(e).splitlines()[0]}），回退到 CPU 转录...")
            return transcribe_on("cpu", "int8")
        raise


def transcribe(
    audio: Path,
    model: str = DEFAULT_MODEL,
    lang: str = "zh",
    device: str = "auto",
    engine: str = "auto",
) -> list[tuple[float, float, str]]:
    """Transcribe `audio`, returning `[(start, end, text), ...]` segments
    in order (seconds, raw untrimmed text). Does not format or drop
    anything — see `format_anchored` / `drop_trailing_hallucination` for
    that, so engine swaps don't need to touch post-processing.

    `engine` is one of `auto` (platform default — mlx on macOS arm64,
    faster-whisper elsewhere), `mlx`, or `faster`. `device` only applies
    to the faster-whisper engine (mlx-whisper always uses Apple's GPU via
    MLX); passing `device="cpu"` with `engine="mlx"` has no effect.
    """
    resolved_engine = _default_engine() if engine == "auto" else engine
    if resolved_engine == "mlx":
        return _transcribe_mlx(audio, model, lang)
    if resolved_engine == "faster":
        if device != "cpu":
            _ensure_cuda_libs(device)
        return _transcribe_faster(audio, model, lang, device)
    raise ValueError(f"未知引擎: {resolved_engine}（可选 auto / mlx / faster）")


def drop_trailing_hallucination(
    segs: list[tuple[float, float, str]], min_repeats: int = 3
) -> list[tuple[float, float, str]]:
    """Drop a trailing run of >= `min_repeats` consecutive segments with
    identical (stripped) text — a common Whisper hallucination at the
    end of Chinese audio (e.g. repeated "请不吝点赞" outros). Segments
    whose text is empty after `.strip()` are dropped first and don't
    count toward the run.

    Keeps the rest of the segments (including any earlier, shorter
    repeated run) untouched.
    """
    cleaned = [(s, e, t) for s, e, t in segs if t.strip()]
    if not cleaned:
        return cleaned

    tail_text = cleaned[-1][2].strip()
    run_len = 0
    for _, _, text in reversed(cleaned):
        if text.strip() == tail_text:
            run_len += 1
        else:
            break

    if run_len >= min_repeats:
        return cleaned[:-run_len]
    return cleaned


def format_anchored(
    segs: list[tuple[float, float, str]], anchor_every: int = 60
) -> str:
    """Segments -> transcript body text with `[HH:MM:SS]` anchor lines.

    A new anchor line starts once `anchor_every` seconds have elapsed
    since the previous anchor (matching `parse_vtt`/`format_segments` in
    the sibling repo). Segments within an anchor block are joined with a
    single space — including for CJK text, which has no natural word
    spacing, to match the sibling repo's output exactly (Ruling R23).
    Segments empty after `.strip()` are dropped.
    """
    next_anchor = 0.0
    lines: list[str] = []
    for start, _end, raw_text in segs:
        text = raw_text.strip()
        if not text:
            continue
        if start >= next_anchor:
            lines.append(f"\n[{fmt_ts(start)}]")
            next_anchor = start + anchor_every
        lines.append(text)
    return " ".join(lines).replace(" \n", "\n").strip()


_YAML_UNSAFE = re.compile(r'[:#\[\]{}&*!|>\'"%@`,]')
_YAML_LOOKS_NUMERIC = re.compile(r"^[-+]?(\d|\.\d)")
_YAML_KEYWORD = re.compile(r"^(null|~|true|false|yes|no|on|off)$", re.IGNORECASE)
_YAML_LEADING_INDICATOR = re.compile(r"^[-?:,\[\]{}#&*!|>'\"%@`]")


def _yaml_scalar(value) -> str:
    """Render a frontmatter scalar value, quoting strings that contain
    YAML-significant characters (colons, quotes, etc.), that look like a
    number, that are a YAML boolean/null keyword (case-insensitive), or
    that start with a YAML indicator character — so the written file
    round-trips through a standard YAML parser as the original string
    rather than being reinterpreted as a different type.
    """
    if isinstance(value, str):
        needs_quoting = (
            value == ""
            or _YAML_UNSAFE.search(value)
            or _YAML_LOOKS_NUMERIC.match(value)
            or _YAML_KEYWORD.match(value)
            or _YAML_LEADING_INDICATOR.match(value)
        )
        if needs_quoting:
            return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'
        return value
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _yaml_block_scalar(key: str, text: str) -> str:
    """Render `key: |` followed by `text` indented 2 spaces per line, so
    long multi-line values (e.g. podcast shownotes) stay readable and
    don't need escaping.
    """
    lines = text.split("\n")
    indented = "\n".join(f"  {line}" if line else "" for line in lines)
    return f"{key}: |\n{indented}"


def _render_frontmatter(meta: dict) -> str:
    lines = ["---"]
    for key, value in meta.items():
        if isinstance(value, str) and "\n" in value:
            lines.append(_yaml_block_scalar(key, value))
        else:
            lines.append(f"{key}: {_yaml_scalar(value)}")
    lines.append("---")
    return "\n".join(lines)


def write_transcript(
    dest: Path,
    meta: dict,
    body: str,
    *,
    seen_txt: Path,
    item_id: str,
    force: bool = False,
    root: Path | None = None,
) -> Path:
    """Write `dest/transcript.md` (frontmatter from `meta` + `body`) and
    append `item_id` to `seen_txt` if not already present.

    `sources/` is append-only (CLAUDE.md), so this refuses to overwrite
    an existing `transcript.md` unless `force=True` — the CLI flag for
    that is `--force`, documented as "only for a transcript that was
    never committed".

    `root` (defaults to `seen_txt.parent.parent`, i.e. the repo root
    given `seen_txt == <root>/sources/seen.txt`) must contain
    `dest/"sources"` as an ancestor: a last-line-of-defense containment
    check (mirrors the TS `within()` helper) against a destination path
    built from an insufficiently sanitized id/slug escaping `sources/`
    (e.g. `..` segments or a symlink). Raises `ValueError` if it doesn't.
    """
    effective_root = root if root is not None else seen_txt.parent.parent
    if not within(dest, effective_root / "sources"):
        raise ValueError(
            f"拒绝写入: {dest} 不在 {effective_root / 'sources'} 之下"
            "（目标路径校验失败，可能是未经过 validate_safe_id 校验的 id/slug）"
        )

    out_path = dest / "transcript.md"
    if out_path.exists() and not force:
        raise FileExistsError(
            f"已存在，sources/ 只增不改，拒绝覆盖: {out_path}\n"
            "仅当该转录稿从未提交过时才可用 --force 覆盖。"
        )

    dest.mkdir(parents=True, exist_ok=True)
    frontmatter = _render_frontmatter(meta)
    out_path.write_text(frontmatter + "\n\n" + body.rstrip("\n") + "\n", encoding="utf-8")

    seen_txt.parent.mkdir(parents=True, exist_ok=True)
    already = (
        set(seen_txt.read_text(encoding="utf-8").split()) if seen_txt.exists() else set()
    )
    if item_id not in already:
        with seen_txt.open("a", encoding="utf-8") as f:
            f.write(item_id + "\n")

    return out_path


def to_wav16k(audio_path: Path, out_dir: Path, ffmpeg: str = "ffmpeg") -> Path:
    """Convert `audio_path` to a 16kHz mono wav in `out_dir` (not needed
    by either engine here — kept for parity with the sibling repo and
    any future diarization step — but exercised by neither fetch script
    today).
    """
    wav = out_dir / "audio16k.wav"
    r = subprocess.run(
        [ffmpeg, "-nostdin", "-y", "-i", str(audio_path), "-ac", "1", "-ar", "16000", str(wav)],
        capture_output=True,
        text=True,
        timeout=1800,
    )
    if r.returncode != 0 or not wav.exists():
        raise RuntimeError(f"ffmpeg 转 wav 失败:\n{r.stderr[-1000:]}")
    return wav
