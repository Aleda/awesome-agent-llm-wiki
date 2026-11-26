"""Tests for scripts/fetch_podcast.py's parse_episode (Task 16).

The fixture (`fixtures/xiaoyuzhou_episode.html`) is a trimmed copy of the
real __NEXT_DATA__ shape for episode 6af00645b4a4e20202f67440 of show
"十字路口Crossing", stripped to only public episode fields (no cookies,
no user ids, no comments) and kept well under 20 KB.
"""

import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SCRIPTS_DIR))

from fetch_podcast import parse_episode  # noqa: E402

FIXTURE = SCRIPTS_DIR / "tests" / "fixtures" / "xiaoyuzhou_episode.html"


def test_fixture_is_small():
    assert FIXTURE.stat().st_size < 20 * 1024


def test_parse_episode_fixture():
    ep = parse_episode(FIXTURE.read_text(encoding="utf-8"))
    assert ep["eid"] == "6af00645b4a4e20202f67440"
    assert ep["show_title"].startswith("十字路口")
    assert ep["duration_minutes"] == 41
    assert ep["audio_url"].startswith("https://")
    assert len(ep["pub_date"]) == 8
    assert ep["pub_date"].isdigit()
    assert "title" in ep and ep["title"]
    assert "description" in ep and ep["description"]


def test_parse_episode_without_next_data():
    with pytest.raises(ValueError, match="__NEXT_DATA__"):
        parse_episode("<html></html>")


def test_parse_episode_without_audio_url():
    html = (
        '<script id="__NEXT_DATA__" type="application/json">'
        '{"props":{"pageProps":{"episode":{"eid":"x","title":"t",'
        '"description":"d","shownotes":"s","duration":60,'
        '"pubDate":"2026-11-08T16:00:00.000Z",'
        '"podcast":{"title":"show"}}}}}'
        "</script>"
    )
    with pytest.raises(ValueError, match="音频地址"):
        parse_episode(html)
