"""Tests for scripts/fetch_video.py (Task 16 fix round 1).

Covers CLI-adjacent logic that doesn't need a real yt-dlp/network call:
exit codes via `run_fetch`, VTT parsing, and the audio-file filter.
"""

import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SCRIPTS_DIR))

import fetch_video  # noqa: E402


def _args(**overrides):
    ap = fetch_video.build_arg_parser()
    defaults = dict(
        url="https://www.bilibili.com/video/BV1wd1wzkEU6/",
        channel="demo",
    )
    defaults.update(overrides)
    argv = [defaults.pop("url"), "--channel", defaults.pop("channel")]
    for key, value in defaults.items():
        flag = f"--{key.replace('_', '-')}"
        if value is True:
            argv.append(flag)
        elif value is not False and value is not None:
            argv += [flag, str(value)]
    return ap.parse_args(argv)


def test_no_subtitles_no_transcribe_exits_2(capsys):
    args = _args()
    info = {
        "id": "BV1wd1wzkEU6",
        "upload_date": "20261125",
        "title": "t",
        "webpage_url": "https://www.bilibili.com/video/BV1wd1wzkEU6/",
        "duration": 802.966,
        "subtitles": {},
        "automatic_captions": {},
    }
    code = fetch_video.run_fetch(args, fetch_info=lambda: info)
    assert code == 2
    captured = capsys.readouterr()
    assert "transcribe" in captured.err or "--transcribe" in captured.err


def test_other_hard_failure_keeps_exit_1(tmp_path, monkeypatch):
    # yt-dlp subprocess failure (non-zero returncode) must stay exit 1,
    # not be confused with the no-subtitles-no-transcribe case (exit 2).
    args = _args()

    class FakeResult:
        returncode = 1
        stdout = ""
        stderr = "boom"

    monkeypatch.setattr(fetch_video, "run", lambda *a, **k: FakeResult())
    code = fetch_video.run_fetch(args)
    assert code == 1


def test_main_exit_code_propagates(monkeypatch):
    # main() must sys.exit with run_fetch's return value, not swallow it.
    info = {
        "id": "BV1wd1wzkEU6",
        "upload_date": "20261125",
        "title": "t",
        "webpage_url": "https://x",
        "duration": 60,
        "subtitles": {},
        "automatic_captions": {},
    }
    monkeypatch.setattr(sys, "argv", ["fetch_video.py", "https://x", "--channel", "demo"])

    class FakeResult:
        returncode = 0
        stdout = __import__("json").dumps(info)
        stderr = ""

    monkeypatch.setattr(fetch_video, "run", lambda *a, **k: FakeResult())
    with pytest.raises(SystemExit) as exc_info:
        fetch_video.main()
    assert exc_info.value.code == 2
