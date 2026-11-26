"""Tests for scripts/lib/transcribe.py (Task 16).

Covers the whisper-free pieces: timestamp formatting, anchored grouping,
Chinese-hallucination trimming, and write_transcript's append-only /
seen.txt behavior. The two ASR engines (mlx-whisper, faster-whisper) are
imported lazily and are not exercised here — see task-16-brief.md ("Do
NOT actually download/transcribe").
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.transcribe import (
    drop_trailing_hallucination,
    fmt_ts,
    format_anchored,
    write_transcript,
)


def test_fmt_ts_basic():
    assert fmt_ts(0) == "00:00:00"
    assert fmt_ts(61) == "00:01:01"
    assert fmt_ts(3661) == "01:01:01"


def test_format_anchored_groups_by_60s():
    out = format_anchored([(0, 5, "a"), (30, 35, "b"), (61, 70, "c"), (125, 130, "d")])
    assert [l[:10] for l in out.splitlines()] == ["[00:00:00]", "[00:01:01]", "[00:02:05]"]


def test_format_anchored_joins_with_single_space_within_block():
    out = format_anchored([(0, 5, "你好"), (10, 15, "世界")])
    lines = out.splitlines()
    assert lines[0] == "[00:00:00] 你好 世界"


def test_format_anchored_drops_empty_segments():
    out = format_anchored([(0, 5, "你好"), (10, 15, "   "), (20, 25, "世界")])
    lines = out.splitlines()
    assert lines[0] == "[00:00:00] 你好 世界"


def test_drop_trailing_hallucination_removes_repeated_tail():
    segs = [
        (0, 5, "正常内容一"),
        (5, 10, "正常内容二"),
        (10, 15, "请不吝点赞"),
        (15, 20, "请不吝点赞"),
        (20, 25, "请不吝点赞"),
    ]
    out = drop_trailing_hallucination(segs)
    assert out == segs[:2]


def test_drop_trailing_hallucination_keeps_non_repeated_tail():
    segs = [(0, 5, "正常内容一"), (5, 10, "正常内容二"), (10, 15, "结尾句")]
    out = drop_trailing_hallucination(segs)
    assert out == segs


def test_drop_trailing_hallucination_keeps_short_runs():
    # Only 2 repeats at the end: below the >=3 threshold, must be kept.
    segs = [(0, 5, "正常内容一"), (5, 10, "重复"), (10, 15, "重复")]
    out = drop_trailing_hallucination(segs)
    assert out == segs


def test_write_transcript_refuses_overwrite(tmp_path):
    dest = tmp_path / "sources" / "videos" / "demo" / "20261101-abc"
    meta = {
        "title": "demo",
        "url": "https://example.com",
        "channel": "demo",
        "upload_date": "2026-11-01",
        "duration_minutes": 13,
        "subtitle": "zh (人工)",
        "fetched": "2026-11-26",
    }
    seen_path = tmp_path / "sources" / "seen.txt"

    out_path = write_transcript(dest, meta, "[00:00:00] 第一段\n", seen_txt=seen_path, item_id="abc")
    assert out_path == dest / "transcript.md"
    assert out_path.exists()
    assert seen_path.read_text(encoding="utf-8").strip().splitlines() == ["abc"]

    with pytest.raises(FileExistsError):
        write_transcript(dest, meta, "[00:00:00] 第二次\n", seen_txt=seen_path, item_id="abc")

    # force=True overwrites and does not duplicate the seen.txt entry.
    out_path2 = write_transcript(
        dest, meta, "[00:00:00] 强制覆盖\n", seen_txt=seen_path, item_id="abc", force=True
    )
    assert "强制覆盖" in out_path2.read_text(encoding="utf-8")
    assert seen_path.read_text(encoding="utf-8").strip().splitlines() == ["abc"]


def test_write_transcript_does_not_duplicate_seen_entry(tmp_path):
    seen_path = tmp_path / "sources" / "seen.txt"
    seen_path.parent.mkdir(parents=True)
    seen_path.write_text("abc\n", encoding="utf-8")

    dest = tmp_path / "sources" / "videos" / "demo" / "20261101-abc"
    meta = {
        "title": "demo",
        "url": "https://example.com",
        "channel": "demo",
        "upload_date": "2026-11-01",
        "duration_minutes": 13,
        "subtitle": "zh (人工)",
        "fetched": "2026-11-26",
    }
    write_transcript(dest, meta, "[00:00:00] 第一段\n", seen_txt=seen_path, item_id="abc")
    assert seen_path.read_text(encoding="utf-8").strip().splitlines() == ["abc"]


def test_write_transcript_frontmatter_contains_meta_keys(tmp_path):
    dest = tmp_path / "sources" / "podcasts" / "show" / "20261108-eid"
    meta = {
        "title": "示例播客",
        "url": "https://www.xiaoyuzhoufm.com/episode/eid",
        "show": "show",
        "upload_date": "2026-11-08",
        "duration_minutes": 41,
        "description": "shownotes 文本",
        "subtitle": "mlx-whisper large-v3-turbo 未校对",
        "fetched": "2026-11-26",
    }
    out_path = write_transcript(
        dest, meta, "[00:00:00] 开场\n", seen_txt=tmp_path / "sources" / "seen.txt", item_id="eid"
    )
    text = out_path.read_text(encoding="utf-8")
    for key in ("title", "url", "show", "upload_date", "duration_minutes", "description", "subtitle", "fetched"):
        assert f"{key}:" in text
