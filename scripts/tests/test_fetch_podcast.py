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

from fetch_podcast import audio_extension, parse_episode, shownotes_html_to_text  # noqa: E402

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


# ---------------------------------------------------------------------------
# Fix round 1, item 2 (Ruling R24): shownotes HTML -> plain text
# ---------------------------------------------------------------------------


def test_shownotes_html_to_text_no_tags_remain():
    import re as _re

    raw_html = FIXTURE_SHOWNOTES = _extract_fixture_shownotes()
    text = shownotes_html_to_text(raw_html)
    assert "<" not in text
    assert not _re.search(r"&[a-zA-Z#0-9]+;", text)  # no leftover entities


def test_shownotes_html_to_text_known_sentence_present():
    text = shownotes_html_to_text(_extract_fixture_shownotes())
    assert "谷雨的 10 个 Aha Moments" in text


def test_shownotes_html_to_text_known_link_url_present():
    text = shownotes_html_to_text(_extract_fixture_shownotes())
    assert "https://www.youtube.com/@kojiyang" in text


def test_shownotes_html_to_text_link_with_text_renders_text_and_url():
    html = '<p>看 <a href="https://example.com/x">这篇文章</a> 了解更多</p>'
    text = shownotes_html_to_text(html)
    assert "这篇文章 (https://example.com/x)" in text


def test_shownotes_html_to_text_link_without_distinct_text_renders_url_only():
    html = '<p><a href="https://example.com/x">https://example.com/x</a></p>'
    text = shownotes_html_to_text(html)
    assert text.strip() == "https://example.com/x"


def test_shownotes_html_to_text_drops_images():
    html = '<p>前言</p><figure><img src="https://example.com/pic.png"></figure><p>正文</p>'
    text = shownotes_html_to_text(html)
    assert "pic.png" not in text
    assert "前言" in text and "正文" in text


def test_shownotes_html_to_text_collapses_blank_lines():
    html = "<p>一</p><p></p><p></p><p>二</p>"
    text = shownotes_html_to_text(html)
    assert "\n\n\n" not in text


def test_shownotes_html_to_text_unescapes_entities():
    html = "<p>A &amp; B &lt;tag&gt; &quot;quoted&quot;</p>"
    text = shownotes_html_to_text(html)
    assert text == 'A & B <tag> "quoted"'


def _extract_fixture_shownotes() -> str:
    import json
    import re

    html = FIXTURE.read_text(encoding="utf-8")
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    data = json.loads(m.group(1))
    return data["props"]["pageProps"]["episode"]["shownotes"]


# ---------------------------------------------------------------------------
# Fix round 1, item 4: audio extension derivation
# ---------------------------------------------------------------------------


def test_audio_extension_strips_query_string():
    assert audio_extension("https://x/a.mp3?token=1") == ".mp3"


def test_audio_extension_defaults_when_no_suffix():
    assert audio_extension("https://x/a") == ".m4a"


def test_audio_extension_defaults_when_suffix_implausible():
    assert audio_extension("https://x/a.verylongextension") == ".m4a"
    assert audio_extension("https://x/a.") == ".m4a"


def test_audio_extension_lowercases():
    assert audio_extension("https://x/a.MP3") == ".mp3"


# ---------------------------------------------------------------------------
# Fix round 1, item 3: id sanitization applied to parsed eid
# ---------------------------------------------------------------------------


def test_parse_episode_allows_malicious_eid_through_unvalidated():
    # parse_episode itself doesn't validate (that's main()'s job, via
    # validate_safe_id before building any path) — this test documents
    # that boundary so the validation isn't silently skipped if
    # parse_episode changes.
    html = (
        '<script id="__NEXT_DATA__" type="application/json">'
        '{"props":{"pageProps":{"episode":{"eid":"../../x","title":"t",'
        '"description":"d","shownotes":"s","duration":60,'
        '"enclosure":{"url":"https://example.com/a.m4a"},'
        '"pubDate":"2026-11-08T16:00:00.000Z",'
        '"podcast":{"title":"show"}}}}}'
        "</script>"
    )
    ep = parse_episode(html)
    assert ep["eid"] == "../../x"

    from lib.transcribe import validate_safe_id

    with pytest.raises(ValueError):
        validate_safe_id(ep["eid"], "episode eid")
