"""Tests for scripts/lint.py (Task 15 brief, Step 1). Each test copies
`tests/fixtures/mini-repo` into a pytest `tmp_path`, mutates it per the
test case, then asserts on `lint(...)`'s output. Run with:
`uv run --with pytest --with pyyaml pytest scripts/tests -q`
"""

import re
import shutil
import subprocess
from datetime import date
from pathlib import Path

import pytest
import yaml

from lint import Issue, lint

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
MINI = REPO_ROOT / "tests/fixtures/mini-repo"
BROKEN = REPO_ROOT / "tests/fixtures/broken-repo"


def has_error(issues: list[Issue], substr: str) -> bool:
    return any(level == "error" and (substr in msg or substr in path) for level, path, msg in issues)


def has_warn(issues: list[Issue], substr: str) -> bool:
    return any(level == "warn" and (substr in msg or substr in path) for level, path, msg in issues)


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    """A plain (non-git) copy of mini-repo — the append-only check must
    skip silently here.
    """
    dest = tmp_path / "repo"
    shutil.copytree(MINI, dest)
    return dest


@pytest.fixture
def git_repo(tmp_path: Path) -> Path:
    """A copy of mini-repo initialised as its own git repo, committed, so
    `git show HEAD:<path>` matches the working tree exactly before a test
    mutates it.
    """
    dest = tmp_path / "git_repo"
    shutil.copytree(MINI, dest)
    run = lambda *args: subprocess.run(args, cwd=dest, check=True, capture_output=True)
    run("git", "init", "-q")
    run("git", "config", "user.email", "test@example.com")
    run("git", "config", "user.name", "Test")
    run("git", "add", "-A")
    run("git", "commit", "-q", "-m", "initial")
    return dest


def _read_frontmatter(path: Path) -> tuple[dict, str, str]:
    text = path.read_text(encoding="utf-8")
    match = re.match(r"^---\n(.*?)\n---\n?(.*)$", text, re.S)
    assert match is not None
    return yaml.safe_load(match.group(1)), match.group(2), text


def _write_frontmatter(path: Path, fm: dict, body: str) -> None:
    front = yaml.safe_dump(fm, allow_unicode=True, sort_keys=False, default_flow_style=None)
    path.write_text(f"---\n{front}---\n{body}", encoding="utf-8")


def add_relation(repo: Path, relpath: str, kind: str, target: str) -> None:
    path = repo / relpath
    fm, body, _ = _read_frontmatter(path)
    fm.setdefault("relations", []).append({kind: target, "rel": "proposes"})
    _write_frontmatter(path, fm, body)


def append_insight(repo: Path, relpath: str, bullet: str) -> None:
    path = repo / relpath
    text = path.read_text(encoding="utf-8")
    marker = "## 新认知\n"
    idx = text.index(marker) + len(marker)
    # insert right after the heading, before the first existing bullet/blank line
    new_text = text[:idx] + "\n" + bullet + text[idx:]
    path.write_text(new_text, encoding="utf-8")


def edit_line(repo: Path, relpath: str, line_no: int, new_line: str) -> None:
    path = repo / relpath
    lines = path.read_text(encoding="utf-8").split("\n")
    lines[line_no] = new_line
    path.write_text("\n".join(lines), encoding="utf-8")


def append(repo: Path, relpath: str, line: str) -> None:
    path = repo / relpath
    text = path.read_text(encoding="utf-8")
    if not text.endswith("\n"):
        text += "\n"
    path.write_text(text + line + "\n", encoding="utf-8")


def write_cache(repo: Path, relpath: str, content: str) -> None:
    path = repo / ".cache" / relpath
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def add_prediction(repo: Path, due: str, status: str) -> None:
    """Append a `## 可验证的预测` section with one expired-looking row to
    the sample paper (any source page type works; the paper already has
    a valid `## 新认知`).
    """
    path = repo / "wiki/papers/202611-sample-paper.md"
    text = path.read_text(encoding="utf-8")
    table = (
        "\n\n## 可验证的预测\n\n"
        "| 预测 | 到期 | 状态 |\n"
        "|---|---|---|\n"
        f"| 测试预测会应验 | {due} | {status} |\n"
    )
    path.write_text(text + table, encoding="utf-8")


def add_alias(repo: Path, relpath: str, alias: str) -> None:
    path = repo / relpath
    fm, body, _ = _read_frontmatter(path)
    fm.setdefault("aliases", []).append(alias)
    _write_frontmatter(path, fm, body)


def set_source_dir(repo: Path, relpath: str, source_dir: str) -> None:
    path = repo / relpath
    fm, body, _ = _read_frontmatter(path)
    fm["source_dir"] = source_dir
    _write_frontmatter(path, fm, body)


def insert_heading_before(repo: Path, relpath: str, marker: str, heading_line: str) -> None:
    """Insert `heading_line` (e.g. `### 来源：...`) immediately before the
    first occurrence of `marker` in the page body, so it becomes an
    earlier block processed by `citations_with_sources`.
    """
    path = repo / relpath
    text = path.read_text(encoding="utf-8")
    idx = text.index(marker)
    new_text = text[:idx] + heading_line + "\n\n" + text[idx:]
    path.write_text(new_text, encoding="utf-8")


def test_mini_repo_has_only_the_known_bad_anchor(repo):
    errs = [i for i in lint(repo, ci=True) if i[0] == "error"]
    assert [(p, "anchor" in m) for _, p, m in errs] == [
        ("wiki/videos/20261101-demo-explainer.md", True)
    ]


def test_missing_relation_target(repo):
    add_relation(repo, "wiki/papers/202611-sample-paper.md", "concept", "nope")
    assert has_error(lint(repo, ci=True), "nope")


def test_insight_without_anchor(repo):
    append_insight(repo, "wiki/papers/202611-sample-paper.md", "- 一条没有锚点的认知")
    assert has_error(lint(repo, ci=True), "新认知")


def test_changed_anchor_line_is_error(git_repo):
    edit_line(git_repo, "sources/papers/2611.00001/anchors.md", 0, "## §3.2 Changed")
    assert has_error(lint(git_repo, ci=True), "anchors.md")


def test_appended_anchor_line_is_fine(git_repo):
    append(git_repo, "sources/papers/2611.00001/anchors.md", "- Tab. 9 — new")
    assert not has_error(lint(git_repo, ci=True), "anchors.md")


def test_cache_verification(repo):
    write_cache(repo, "papers/2611.00001/paper.md", "no matching text")
    assert has_error(lint(repo), "§3.2")


def test_cache_skipped_in_ci(repo):
    write_cache(repo, "papers/2611.00001/paper.md", "no matching text")
    assert not has_error(lint(repo, ci=True), "§3.2")


def test_expired_prediction(repo):
    add_prediction(repo, "2026-01", "待验证")
    assert has_warn(lint(repo, ci=True, today=date(2026, 11, 26)), "预测")


def test_alias_collision(repo):
    add_alias(repo, "wiki/concepts/isolated-idea.md", "Context Compaction")
    assert has_warn(lint(repo, ci=True), "别名")


def test_unexpired_prediction_is_not_flagged(repo):
    add_prediction(repo, "2027-01", "待验证")
    assert not has_warn(lint(repo, ci=True, today=date(2026, 11, 26)), "预测")


def test_resolved_prediction_is_not_flagged_even_if_expired(repo):
    add_prediction(repo, "2026-01", "已应验")
    assert not has_warn(lint(repo, ci=True, today=date(2026, 11, 26)), "预测")


def test_broken_repo_reports_the_three_ts_side_errors(repo, tmp_path):
    dest = tmp_path / "broken"
    shutil.copytree(BROKEN, dest)
    errs = [i for i in lint(dest, ci=True) if i[0] == "error"]
    assert len(errs) == 3
    assert has_error(errs, "Bad-Name.md")
    assert has_error(errs, "summary exceeds")
    assert has_error(errs, "nonexistent-concept")


def test_exit_code_zero_without_errors(repo):
    # mini-repo's single contractual error (the [09:09:09] bad anchor) is
    # inside the video page's 时间线 section, not its 新认知; fixing that
    # one known-bad citation should leave an error-free repo.
    path = repo / "wiki/videos/20261101-demo-explainer.md"
    text = path.read_text(encoding="utf-8")
    path.write_text(text.replace("（[09:09:09]）", "（[00:01:02]）"), encoding="utf-8")
    issues = lint(repo, ci=True)
    assert not any(level == "error" for level, _, _ in issues)


def test_removed_tracked_file_is_an_error(git_repo):
    (git_repo / "sources/papers/2611.00001/anchors.md").unlink()
    assert has_error(lint(git_repo, ci=True), "anchors.md")


# --- Defect 1 (controller ruling R27): seen.txt / skipped.txt are
# append-only logs, like anchors.md, not immutable files. ------------------


def test_appending_to_seen_txt_is_fine(git_repo):
    append(git_repo, "sources/seen.txt", "2611.99999")
    assert not has_error(lint(git_repo, ci=True), "seen.txt")


def test_editing_existing_seen_txt_line_is_an_error(git_repo):
    edit_line(git_repo, "sources/seen.txt", 0, "changed-line")
    assert has_error(lint(git_repo, ci=True), "seen.txt")


def test_appending_to_skipped_txt_is_fine(git_repo):
    append(git_repo, "sources/skipped.txt", "2611.99999")
    assert not has_error(lint(git_repo, ci=True), "skipped.txt")


def test_editing_existing_skipped_txt_line_is_an_error(git_repo):
    edit_line(git_repo, "sources/skipped.txt", 0, "changed-line")
    assert has_error(lint(git_repo, ci=True), "skipped.txt")


def test_not_a_git_repo_skips_append_only_check(repo):
    # repo is a plain directory copy, never `git init`-ed: mutating a
    # "tracked" source file must not raise or report an append-only error.
    edit_line(repo, "sources/papers/2611.00001/anchors.md", 0, "## §3.2 Changed")
    issues = lint(repo, ci=True)
    assert not has_error(issues, "anchors.md")


# --- Fix round 1 -----------------------------------------------------------


@pytest.mark.parametrize(
    "bad_source_dir",
    ["/etc/passwd", "../../etc", "wiki/x"],
)
def test_invalid_source_dir_is_an_error(repo, bad_source_dir):
    set_source_dir(repo, "wiki/papers/202611-sample-paper.md", bad_source_dir)
    errs = [i for i in lint(repo, ci=True) if i[0] == "error"]
    matches = [e for e in errs if "source_dir" in e[2] and bad_source_dir in e[2]]
    assert len(matches) == 1, f"expected exactly one source_dir error for {bad_source_dir!r}, got {errs}"


def test_valid_source_dir_is_not_flagged(repo):
    set_source_dir(repo, "wiki/papers/202611-sample-paper.md", "sources/papers/2611.00001")
    errs = [i for i in lint(repo, ci=True) if i[0] == "error"]
    assert not any("source_dir" in e[2] for e in errs)


def test_invalid_source_dir_does_not_duplicate_or_mislead_other_checks(repo):
    # an invalid source_dir must not also trigger a second, misleading
    # error from a source_dir-based check (e.g. treating it as a missing
    # anchor table) — only the dedicated validity check should fire for it.
    set_source_dir(repo, "wiki/papers/202611-sample-paper.md", "/etc/passwd")
    errs = [i for i in lint(repo, ci=True) if i[0] == "error"]
    source_dir_errs = [e for e in errs if "source_dir" in e[2]]
    other_errs_on_same_page = [
        e for e in errs if e[1] == "wiki/papers/202611-sample-paper.md" and "source_dir" not in e[2]
    ]
    assert len(source_dir_errs) == 1
    assert other_errs_on_same_page == []


def test_mini_repo_still_exactly_one_error_after_source_dir_check_added(repo):
    errs = [i for i in lint(repo, ci=True) if i[0] == "error"]
    assert [(p, "anchor" in m) for _, p, m in errs] == [
        ("wiki/videos/20261101-demo-explainer.md", True)
    ]


def test_broken_repo_still_exactly_three_errors_after_source_dir_check_added(tmp_path):
    dest = tmp_path / "broken"
    shutil.copytree(BROKEN, dest)
    errs = [i for i in lint(dest, ci=True) if i[0] == "error"]
    assert len(errs) == 3


def test_heading_starting_with_source_marker_does_not_switch_source(repo):
    # TS remark-wiki.ts only switches the "current source" on a paragraph
    # node (`node.type === 'paragraph'`); an ATX heading that happens to
    # start with 来源： must not trigger the switch.
    insert_heading_before(
        repo,
        "wiki/concepts/context-compaction.md",
        "## 开放问题",
        "### 来源：[v](../videos/20261101-demo-explainer.md)",
    )
    append(repo, "wiki/concepts/context-compaction.md", "观点（[00:01:02]）")
    # the citation above has no resolvable source (concept page has no
    # source_dir, and the heading never switched `current`), so it must
    # not be checked against the video's transcript anchors at all —
    # i.e. it must not appear as an anchor-not-found error.
    issues = lint(repo, ci=True)
    assert not has_error(issues, "00:01:02")


def test_git_subprocess_helpers_handle_chinese_text(tmp_path):
    """git_toplevel/git_tracked_files/git_show_head must decode subprocess
    output as UTF-8 regardless of locale (`encoding='utf-8'`, not bare
    `text=True`), so a tracked file containing Chinese text round-trips.
    """
    from lint import git_show_head, git_toplevel, git_tracked_files

    repo_dir = tmp_path / "chinese_repo"
    repo_dir.mkdir()
    sources = repo_dir / "sources" / "papers" / "x"
    sources.mkdir(parents=True)
    content = "## §1 测试章节标题\n\n- §1: \"这是一句包含中文的引用短句\"\n"
    (sources / "anchors.md").write_text(content, encoding="utf-8")

    run = lambda *args: subprocess.run(args, cwd=repo_dir, check=True, capture_output=True)
    run("git", "init", "-q")
    run("git", "config", "user.email", "test@example.com")
    run("git", "config", "user.name", "Test")
    run("git", "add", "-A")
    run("git", "commit", "-q", "-m", "中文提交说明")

    top = git_toplevel(repo_dir)
    assert top is not None

    tracked = git_tracked_files(top, "sources")
    assert "sources/papers/x/anchors.md" in tracked

    shown = git_show_head(top, "sources/papers/x/anchors.md")
    assert shown == content


# --- `--base <ref>`: the append-only check compares against a base commit,
# so it still bites in CI where the working tree equals HEAD. -------------


def _git(repo: Path, *args: str) -> str:
    return subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True, encoding="utf-8").stdout.strip()


def _commit_all(repo: Path, message: str) -> None:
    _git(repo, "add", "-A")
    _git(repo, "commit", "-q", "-m", message)


def test_base_edit_committed_after_base_is_an_error(git_repo):
    base = _git(git_repo, "rev-parse", "HEAD")
    edit_line(git_repo, "sources/papers/2611.00001/anchors.md", 0, "## §3.2 Changed")
    _commit_all(git_repo, "edit anchors")
    # HEAD == working tree, so the HEAD comparison sees nothing ...
    assert not has_error(lint(git_repo, ci=True), "anchors.md")
    # ... but the base comparison does.
    assert has_error(lint(git_repo, ci=True, base=base), "anchors.md")


def test_base_append_committed_after_base_is_fine(git_repo):
    base = _git(git_repo, "rev-parse", "HEAD")
    append(git_repo, "sources/papers/2611.00001/anchors.md", "- Tab. 9 — new")
    append(git_repo, "sources/seen.txt", "2611.99999")
    _commit_all(git_repo, "append")
    issues = lint(git_repo, ci=True, base=base)
    assert not has_error(issues, "anchors.md")
    assert not has_error(issues, "seen.txt")


def test_base_deletion_committed_after_base_is_an_error(git_repo):
    base = _git(git_repo, "rev-parse", "HEAD")
    (git_repo / "sources/videos/demo/20261101-abc/transcript.md").unlink()
    _commit_all(git_repo, "delete transcript")
    assert has_error(lint(git_repo, ci=True, base=base), "transcript.md")


def test_base_new_file_after_base_can_change_freely(git_repo):
    base = _git(git_repo, "rev-parse", "HEAD")
    new = git_repo / "sources/papers/2611.00002/meta.yaml"
    new.parent.mkdir(parents=True)
    new.write_text("title: a\n", encoding="utf-8")
    _commit_all(git_repo, "add source")
    new.write_text("title: b\n", encoding="utf-8")
    _commit_all(git_repo, "edit new source")
    assert not has_error(lint(git_repo, ci=True, base=base), "2611.00002")


def test_base_unknown_ref_is_an_error(git_repo):
    assert has_error(lint(git_repo, ci=True, base="no-such-ref"), "no-such-ref")


def test_base_cli_flag(git_repo):
    from lint import main

    base = _git(git_repo, "rev-parse", "HEAD")
    edit_line(git_repo, "sources/seen.txt", 0, "changed-line")
    _commit_all(git_repo, "edit seen")
    assert main(["--ci", "--root", str(git_repo), "--base", base]) == 1


# --- glossary slugs (github-slugger semantics) and dead internal links. ----


PAPER_MD = "wiki/papers/202611-sample-paper.md"


def add_body(repo: Path, relpath: str, text: str) -> None:
    path = repo / relpath
    path.write_text(path.read_text(encoding="utf-8") + "\n" + text + "\n", encoding="utf-8")


@pytest.mark.parametrize(
    ("term", "expected"),
    [
        ("BrowseComp-Plus", "browsecomp-plus"),
        ("Amdahl's law", "amdahls-law"),
        ("Claude Opus 5.5", "claude-opus-55"),
        ("prefix-reuse FLOPs", "prefix-reuse-flops"),
        ("SWE-bench Verified", "swe-bench-verified"),
        ("上下文 压缩", "上下文-压缩"),
        ("<术语>", "术语"),
        ("Café ñ — x", "café-ñ--x"),
    ],
)
def test_slug_matches_github_slugger(term, expected):
    from lib.slug import slug

    assert slug(term) == expected


def test_glossary_fragment_matching_a_heading_is_fine(repo):
    add_body(repo, PAPER_MD, "见 [GRPO](../glossary.md#grpo)。")
    assert not has_error(lint(repo, ci=True), "glossary")


def test_glossary_fragment_without_heading_is_an_error(repo):
    add_body(repo, PAPER_MD, "见 [X](../glossary.md#no-such-term)。")
    assert has_error(lint(repo, ci=True), "no-such-term")


def test_glossary_fragment_uses_github_slug_not_dash_collapse(repo):
    glossary = repo / "wiki/glossary.md"
    glossary.write_text(
        glossary.read_text(encoding="utf-8") + "\n## Amdahl's law\n\n加速比上限。\n", encoding="utf-8"
    )
    add_body(repo, PAPER_MD, "见 [A](../glossary.md#amdahls-law)。")
    assert not has_error(lint(repo, ci=True), "amdahls-law")
    add_body(repo, PAPER_MD, "见 [A](../glossary.md#amdahl-s-law)。")
    assert has_error(lint(repo, ci=True), "amdahl-s-law")


def test_glossary_heading_inside_fence_is_not_a_term(repo):
    glossary = repo / "wiki/glossary.md"
    glossary.write_text(
        glossary.read_text(encoding="utf-8") + "\n```\n## Fenced Term\n```\n", encoding="utf-8"
    )
    add_body(repo, PAPER_MD, "见 [F](../glossary.md#fenced-term)。")
    assert has_error(lint(repo, ci=True), "fenced-term")


def test_dead_wiki_link_is_an_error(repo):
    add_body(repo, PAPER_MD, "见 [没有的概念](../concepts/no-such-concept.md)。")
    assert has_error(lint(repo, ci=True), "no-such-concept")


def test_link_to_redirected_page_is_fine(repo):
    add_body(repo, PAPER_MD, "见 [旧名](../concepts/old-name.md)。")
    assert not has_error(lint(repo, ci=True), "old-name")


def test_link_to_existing_sources_file_is_fine(repo):
    add_body(repo, PAPER_MD, "见 [转录](../../sources/videos/demo/20261101-abc/transcript.md#t-000102)。")
    assert not has_error(lint(repo, ci=True), "transcript")


def test_dead_sources_link_is_an_error(repo):
    add_body(repo, PAPER_MD, "见 [锚点](../../sources/papers/9999.99999/anchors.md)。")
    assert has_error(lint(repo, ci=True), "9999.99999")


def test_link_outside_wiki_and_sources_is_an_error(repo):
    add_body(repo, PAPER_MD, "见 [规范](../../README.md)。")
    assert has_error(lint(repo, ci=True), "README")


def test_links_in_code_external_and_images_are_ignored(repo):
    add_body(
        repo,
        PAPER_MD,
        "写法 `[术语](../glossary.md#<slug>)`。\n\n```\n[x](../concepts/nope-fenced.md)\n```\n\n"
        "外链 [a](https://example.com/x.md)，图片 ![i](../img/nope.md)。",
    )
    issues = lint(repo, ci=True)
    assert not has_error(issues, "nope-fenced")
    assert not has_error(issues, "<slug>")
    assert not has_error(issues, "example.com")
    assert not has_error(issues, "img/nope")
