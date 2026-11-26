# /// script
# requires-python = ">=3.10"
# dependencies = ["pyyaml"]
# ///
"""Wiki linter (Task 15, spec CLAUDE.md "lint 检查项"). Checks anchors,
append-only `sources/`, relation targets, and content quality against
`wiki/**/*.md`. Semantics for anchor parsing, citation scanning and
"current source" resolution match the TypeScript implementation exactly
(`site/src/lib/anchors.ts`, `site/src/lib/remark-wiki.ts`,
`site/src/lib/content-index.ts` — see `scripts/lib/anchors.py` for the
ported grammar).

Usage: `uv run scripts/lint.py [--ci]` from anywhere; `root` defaults to
the repo root (two levels up from this file). `--ci` skips the `.cache/`
full-text verification (that directory is gitignored, so CI never has it).
"""

from __future__ import annotations

import re
import subprocess
import sys
import posixpath
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path
from typing import Literal

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib.anchors import find_citations, parse_anchors_md, parse_transcript_anchors, verify_against_fulltext  # noqa: E402

Level = Literal["error", "warn"]
Issue = tuple[Level, str, str]

WIKI_FILENAME_RE = re.compile(r"^[a-z0-9][a-z0-9.-]*\.md$")
FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n?(.*)$", re.S)
HEADING_RE = re.compile(r"^##\s+(.+?)\s*$")
BULLET_RE = re.compile(r"^-\s+(.*)$")
MD_LINK_RE = re.compile(r'(?<!!)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)')
SCHEME_RE = re.compile(r"^[a-z][a-z0-9+.-]*:", re.I)
SOURCE_RAW_RE = re.compile(r"^(sources/.+)/(?:transcript|anchors)$")

SOURCE_TYPES = {"paper", "blog", "video", "podcast"}

MAX_SUMMARY_CHARS = 60
MIN_INSIGHTS = 3
MAX_INSIGHTS = 10


@dataclass
class Page:
    id: str  # e.g. wiki/papers/202611-sample-paper
    relpath: str  # e.g. wiki/papers/202611-sample-paper.md
    fm: dict
    body: str
    sections: dict[str, str] = field(default_factory=dict)


def split_frontmatter(text: str) -> tuple[dict, str]:
    """Split a `.md` file into (frontmatter dict, body). Mirrors gray-matter:
    an absent or malformed `---` block yields `({}, text)`.
    """
    match = FRONTMATTER_RE.match(text)
    if not match:
        return {}, text
    data = yaml.safe_load(match.group(1))
    return (data or {}), match.group(2)


def split_sections(body: str) -> dict[str, str]:
    """Split a page body into sections keyed by `## <heading>` text.
    Content before the first H2 is dropped. Mirrors `splitSections` in
    `content-index.ts`.
    """
    sections: dict[str, str] = {}
    lines = body.split("\n")
    current_heading: str | None = None
    buffer: list[str] = []

    def flush():
        if current_heading is not None:
            sections[current_heading] = "\n".join(buffer).strip()

    for line in lines:
        match = HEADING_RE.match(line)
        if match:
            flush()
            current_heading = match.group(1)
            buffer = []
        else:
            buffer.append(line)
    flush()

    return sections


def load_pages(root: Path) -> tuple[list[Page], list[str]]:
    """Walk `wiki/**/*.md`, parsing frontmatter and body. Returns
    (pages, filename_errors) — a page whose filename fails the wiki
    filename pattern is reported but not included in `pages` (nothing
    downstream can resolve it as a target anyway, same as `loadRepo`).
    """
    pages: list[Page] = []
    errors: list[str] = []
    wiki_dir = root / "wiki"
    if not wiki_dir.is_dir():
        return pages, errors

    for path in sorted(wiki_dir.rglob("*.md")):
        relpath = path.relative_to(root).as_posix()
        filename = path.name
        if not WIKI_FILENAME_RE.match(filename):
            errors.append(
                f"invalid filename (must match ^[a-z0-9][a-z0-9.-]*\\.md$): {relpath}"
            )
            continue

        text = path.read_text(encoding="utf-8")
        fm, body = split_frontmatter(text)
        page_id = relpath[: -len(".md")]
        pages.append(Page(id=page_id, relpath=relpath, fm=fm, body=body, sections=split_sections(body)))

    return pages, errors


def resolve_link(from_id: str, href: str) -> tuple[str, str] | None:
    """Resolve a relative `.md` link found in a page body to a page id +
    hash. Returns `None` for external links (any URL scheme) and for
    non-`.md` targets (images, other assets). Mirrors `resolveLink` in
    `site/src/lib/content-index.ts`.
    """
    if SCHEME_RE.match(href) or href.startswith("//"):
        return None
    hash_index = href.find("#")
    if hash_index == -1:
        hash_, without_hash = "", href
    else:
        hash_, without_hash = href[hash_index:], href[:hash_index]
    if not without_hash.endswith(".md"):
        return None
    from_dir = posixpath.dirname(from_id)
    normalized = posixpath.normpath(posixpath.join(from_dir, without_hash))
    page_id = normalized[: -len(".md")] if normalized.endswith(".md") else normalized
    return page_id, hash_


def resolve_relation_target(relation: dict) -> str:
    """Resolve a relation's target key (`concept`/`source`/`topic`) to a
    page id. Mirrors `resolveTarget` in `content-index.ts`.
    """
    if relation.get("concept") is not None:
        return f"wiki/concepts/{relation['concept']}"
    if relation.get("topic") is not None:
        return f"wiki/topics/{relation['topic']}"
    if relation.get("source") is not None:
        return f"wiki/{relation['source']}"
    raise ValueError("relation has no resolvable target")


def resolve_entity_target(entity: str) -> str:
    return f"wiki/entities/{entity}"


def extract_md_links(text: str) -> list[tuple[str, str]]:
    """Extract `[text](href)` Markdown links from a block of text, in
    order. Image links (`![alt](src)`) are excluded.
    """
    return [(m.group(1), m.group(2)) for m in MD_LINK_RE.finditer(text)]


def build_redirects(pages_by_id: dict[str, Page]) -> dict[str, str]:
    """`redirect_to: <slug>` on a concept page maps it to
    `wiki/concepts/<slug>`. Mirrors the `redirects` map `loadRepo` builds.
    """
    redirects: dict[str, str] = {}
    for page in pages_by_id.values():
        redirect_to = page.fm.get("redirect_to")
        if isinstance(redirect_to, str):
            redirects[page.id] = f"wiki/concepts/{redirect_to}"
    return redirects


def follow_redirects(redirects: dict[str, str], page_id: str) -> str:
    seen: set[str] = set()
    current = page_id
    while current in redirects and current not in seen:
        seen.add(current)
        current = redirects[current]
    return current


def page_target_exists(pages_by_id: dict[str, Page], redirects: dict[str, str], target_id: str) -> bool:
    return target_id in pages_by_id or target_id in redirects


def source_dir_of_target(pages_by_id: dict[str, Page], redirects: dict[str, str], target_id: str) -> str | None:
    """The `source_dir` a link target belongs to: a wiki page's
    `source_dir` frontmatter value, or for a raw file under `sources/`
    its directory (`.../transcript`, `.../anchors` dropped). Mirrors
    `sourceOf` in `remark-wiki.ts`.
    """
    resolved_id = follow_redirects(redirects, target_id)
    page = pages_by_id.get(resolved_id)
    if page is not None:
        source_dir = page.fm.get("source_dir")
        return source_dir if isinstance(source_dir, str) else None
    match = SOURCE_RAW_RE.match(target_id)
    if match:
        return match.group(1)
    return None


def split_paragraphs(body: str) -> list[str]:
    """Split a page body into blank-line-separated blocks — the
    simplified "paragraph" granularity the binding decisions specify for
    applying the `来源：` rule (a real remark AST has finer-grained nodes
    per block, but citations/`来源：` detection only needs block-level
    text).
    """
    return [b for b in re.split(r"\n\s*\n", body) if b.strip() != ""]


def group_bounds(text: str, start: int, end: int) -> tuple[int, int]:
    """The `（…）` group span (end-exclusive, group markers excluded)
    containing a citation at `[start, end)`. Mirrors the `groupStart`/
    `groupEnd` lookup in `remark-wiki.ts`'s citation pass.
    """
    group_start = text.rfind("（", 0, start)
    group_end = text.find("）", end)
    return group_start, group_end


def citations_with_sources(
    pages_by_id: dict[str, Page],
    redirects: dict[str, str],
    from_id: str,
) -> list[tuple[str, str | None]]:
    """For page `from_id`, find every citation token in its body and
    resolve the "current source" (`source_dir`) it should be checked
    against, applying the three rules from `remark-wiki.ts`:
    the page's own `source_dir` is the default; a `来源：` paragraph
    switches it to its first link's target's source until the next
    `来源：` paragraph; a link inside the same `（…）` group as a citation
    overrides both. Returns `(citation_key, source_dir_or_None)` pairs —
    `None` means no resolvable source (not itself an error; the anchor
    check only flags a citation whose resolved source lacks that key).
    """
    page = pages_by_id[from_id]
    own_source = page.fm.get("source_dir")
    current: str | None = own_source if isinstance(own_source, str) else None

    results: list[tuple[str, str | None]] = []

    for block in split_paragraphs(page.body):
        links = extract_md_links(block)

        if block.lstrip().startswith("来源："):
            if links:
                target = resolve_link(from_id, links[0][1])
                current = source_dir_of_target(pages_by_id, redirects, target[0]) if target else None
            else:
                current = None
            continue

        # Re-locate link spans within this block's raw text so we can tell
        # which links sit inside the same （…） group as a given citation.
        link_spans: list[tuple[int, int, str]] = []
        search_from = 0
        for text_, href in links:
            token = f"[{text_}]({href}"
            idx = block.find(token, search_from)
            if idx == -1:
                continue
            link_spans.append((idx, idx + len(token) + 1, href))
            search_from = idx + len(token)

        for cite in find_citations_with_spans(block):
            key, start, end = cite
            group_start, group_end = group_bounds(block, start, end)
            in_group = [l for l in link_spans if l[0] > group_start and l[1] <= group_end]
            preceding = [l for l in in_group if l[1] <= start]
            group_link = preceding[-1] if preceding else (in_group[0] if in_group else None)

            source: str | None = None
            if group_link is not None:
                target = resolve_link(from_id, group_link[2])
                source = source_dir_of_target(pages_by_id, redirects, target[0]) if target else None
            if source is None:
                source = current

            results.append((key, source))

    return results


CITATION_TOKEN_RE = re.compile(
    r"\[(\d{2}:\d{2}:\d{2})\]|§(\d+(?:\.\d+)*)(?:¶(\d+))?|Fig\.\s+\d+|Tab\.\s+\d+"
)
PAREN_GROUP_RE = re.compile(r"（([^（）]*)）")


def find_citations_with_spans(text: str) -> list[tuple[str, int, int]]:
    """Like `lib.anchors.find_citations`, but also returns each
    citation's `(start, end)` offsets into `text` so the `（…）`-group
    link-override rule can be applied. Kept local to `lint.py` since only
    this module needs the offsets.
    """
    out: list[tuple[str, int, int]] = []
    for group_match in PAREN_GROUP_RE.finditer(text):
        group_content = group_match.group(1)
        group_start = group_match.start(1)
        for token in CITATION_TOKEN_RE.finditer(group_content):
            token_start = group_start + token.start()
            token_end = group_start + token.end()
            timestamp = token.group(1)
            key = timestamp if timestamp is not None else token.group(0)
            out.append((key, token_start, token_end))
    return out


# ---------------------------------------------------------------------------
# Checks — each returns a list[Issue], one function per check.
# ---------------------------------------------------------------------------


def check_relation_targets(pages_by_id: dict[str, Page], redirects: dict[str, str]) -> list[Issue]:
    """error: a `relations` entry's target, or a `by` entry's `entity`
    target, does not exist (nor resolve via a redirect).
    """
    issues: list[Issue] = []
    for page in pages_by_id.values():
        if page.fm.get("type") == "raw":
            continue

        relations = page.fm.get("relations") or []
        for relation in relations:
            if not isinstance(relation, dict):
                continue
            try:
                target_id = resolve_relation_target(relation)
            except ValueError:
                continue  # malformed relation (no concept/topic/source key): not this check's job
            if not page_target_exists(pages_by_id, redirects, target_id):
                issues.append(
                    (
                        "error",
                        page.relpath,
                        f"relation target does not exist: {target_id} (rel: {relation.get('rel')})",
                    )
                )

        by_list = page.fm.get("by") or []
        for by in by_list:
            if not isinstance(by, dict):
                continue
            entity = by.get("entity")
            if entity is None:
                continue
            target_id = resolve_entity_target(entity)
            if not page_target_exists(pages_by_id, redirects, target_id):
                issues.append(
                    ("error", page.relpath, f"by.entity target does not exist: {target_id}")
                )

    return issues


def check_summary_length(pages_by_id: dict[str, Page]) -> list[Issue]:
    """error: `summary` frontmatter longer than 60 characters. `type:
    raw` pages have no `summary` requirement.
    """
    issues: list[Issue] = []
    for page in pages_by_id.values():
        if page.fm.get("type") == "raw":
            continue
        summary = page.fm.get("summary")
        if isinstance(summary, str) and len(summary) > MAX_SUMMARY_CHARS:
            issues.append(
                ("error", page.relpath, f"summary exceeds {MAX_SUMMARY_CHARS} characters ({len(summary)})")
            )
    return issues


def load_source_anchor_keys(root: Path, source_dir: str) -> set[str] | None:
    """The set of valid citation keys for a `source_dir`: `anchors.md`
    keys for a paper/blog, `transcript.md` timestamp keys for a
    video/podcast. Returns `None` when neither file exists (source has no
    anchor table at all — not itself an error here; the caller decides).
    """
    base = root / source_dir
    anchors_path = base / "anchors.md"
    transcript_path = base / "transcript.md"
    if anchors_path.is_file():
        return set(parse_anchors_md(anchors_path.read_text(encoding="utf-8")).keys())
    if transcript_path.is_file():
        return parse_transcript_anchors(transcript_path.read_text(encoding="utf-8"))
    return None


def check_anchors_exist(root: Path, pages_by_id: dict[str, Page], redirects: dict[str, str]) -> list[Issue]:
    """error: a citation in a page's body resolves to a source whose
    anchor table (anchors.md / transcript.md) doesn't have that key.
    A citation that resolves to no source at all is skipped (nothing to
    check against) — this mirrors the site rendering it as plain text,
    not a dead link.
    """
    issues: list[Issue] = []
    anchor_cache: dict[str, set[str] | None] = {}

    for page in pages_by_id.values():
        if page.fm.get("type") == "raw":
            continue
        for key, source_dir in citations_with_sources(pages_by_id, redirects, page.id):
            if source_dir is None:
                continue
            if source_dir not in anchor_cache:
                anchor_cache[source_dir] = load_source_anchor_keys(root, source_dir)
            keys = anchor_cache[source_dir]
            if keys is not None and key not in keys:
                issues.append(
                    ("error", page.relpath, f"anchor not found in source {source_dir}: {key}")
                )

    return issues


def find_cache_fulltext(root: Path, source_dir: str) -> str | None:
    """Full text for a `source_dir` under `.cache/`, at
    `<root>/.cache/<source_dir minus leading 'sources/'>/`. Any `*.md` or
    `*.txt` file there counts (papers use `paper.md`, blogs `article.md`,
    but any matching file is accepted). Returns `None` when the cache
    directory doesn't exist or has no matching file.
    """
    if not source_dir.startswith("sources/"):
        return None
    cache_dir = root / ".cache" / source_dir[len("sources/") :]
    if not cache_dir.is_dir():
        return None
    candidates = sorted(cache_dir.glob("*.md")) + sorted(cache_dir.glob("*.txt"))
    if not candidates:
        return None
    return candidates[0].read_text(encoding="utf-8")


def check_cache_fulltext(root: Path, pages_by_id: dict[str, Page], ci: bool) -> list[Issue]:
    """error (skipped under `--ci`, and silently when `.cache/` has no
    matching file for a source): a paper/blog's `anchors.md` title or
    quoted sentence doesn't appear verbatim in the cached full text.
    """
    if ci:
        return []

    issues: list[Issue] = []
    checked_source_dirs: set[str] = set()

    for page in pages_by_id.values():
        if page.fm.get("type") not in ("paper", "blog"):
            continue
        source_dir = page.fm.get("source_dir")
        if not isinstance(source_dir, str) or source_dir in checked_source_dirs:
            continue
        checked_source_dirs.add(source_dir)

        anchors_path = root / source_dir / "anchors.md"
        if not anchors_path.is_file():
            continue
        fulltext = find_cache_fulltext(root, source_dir)
        if fulltext is None:
            continue

        anchors = parse_anchors_md(anchors_path.read_text(encoding="utf-8"))
        missing = verify_against_fulltext(anchors, fulltext)
        for key in missing:
            issues.append(
                ("error", page.relpath, f"anchor {key} not found verbatim in cached full text ({source_dir})")
            )

    return issues


def git_toplevel(root: Path) -> str | None:
    """`git -C <root> rev-parse --show-toplevel`, or `None` when `root`
    isn't inside a git working tree (the fixtures aren't, by design).
    """
    try:
        result = subprocess.run(
            ["git", "-C", str(root), "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        return None
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def git_tracked_files(repo_root: str, subpath: str) -> list[str]:
    """Paths (relative to `repo_root`) of every file tracked at HEAD
    under `subpath`.
    """
    result = subprocess.run(
        ["git", "-C", repo_root, "ls-tree", "-r", "--name-only", "HEAD", "--", subpath],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return []
    return [line for line in result.stdout.splitlines() if line.strip()]


def git_show_head(repo_root: str, relpath: str) -> str | None:
    """`git show HEAD:<relpath>`'s content, or `None` if that path isn't
    tracked at HEAD.
    """
    result = subprocess.run(
        ["git", "-C", repo_root, "show", f"HEAD:{relpath}"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return None
    return result.stdout


def check_append_only(root: Path) -> list[Issue]:
    """error: a file tracked under `sources/` at HEAD has been modified
    in the working tree. For `anchors.md`, only an append is allowed —
    every line HEAD had must still be there, in order, as a prefix of the
    working copy's lines (lint reports a single error per changed file,
    not per line). Skipped entirely (no issues, no crash) when `root`
    isn't a git working tree — the brief's fixtures are not git repos.
    """
    repo_root = git_toplevel(root)
    if repo_root is None:
        return []

    issues: list[Issue] = []
    sources_dir = root / "sources"
    if not sources_dir.is_dir():
        return []

    repo_root_path = Path(repo_root).resolve()
    root_resolved = root.resolve()
    sources_rel_to_repo = (
        root_resolved.relative_to(repo_root_path) / "sources"
        if root_resolved != repo_root_path
        else Path("sources")
    )

    for tracked_relpath in git_tracked_files(repo_root, sources_rel_to_repo.as_posix()):
        abs_path = repo_root_path / tracked_relpath
        working_relpath = (
            abs_path.relative_to(root_resolved).as_posix() if _is_relative_to(abs_path, root_resolved) else None
        )
        if working_relpath is None:
            continue
        if not abs_path.is_file():
            issues.append(("error", working_relpath, "tracked sources/ file was deleted"))
            continue

        head_text = git_show_head(repo_root, tracked_relpath)
        if head_text is None:
            continue
        working_text = abs_path.read_text(encoding="utf-8")

        if abs_path.name == "anchors.md":
            head_lines = head_text.splitlines()
            working_lines = working_text.splitlines()
            if working_lines[: len(head_lines)] != head_lines:
                issues.append(
                    ("error", working_relpath, "anchors.md changed or removed an existing line (append-only)")
                )
        else:
            if working_text != head_text:
                issues.append(("error", working_relpath, "committed sources/ file was modified (append-only)"))

    return issues


def _is_relative_to(path: Path, other: Path) -> bool:
    try:
        path.relative_to(other)
        return True
    except ValueError:
        return False


def insight_bullets(page: Page) -> list[str]:
    """Top-level `- ` bullets of a page's `## 新认知` section, or `[]`
    when the section is missing. Mirrors `topLevelBullets` in
    `prepare.ts`.
    """
    section = page.sections.get("新认知")
    if section is None:
        return []
    return [m.group(1) for line in section.split("\n") if (m := BULLET_RE.match(line))]


def check_insights(pages_by_id: dict[str, Page]) -> list[Issue]:
    """error: a source page (paper/blog/video/podcast) is missing
    `## 新认知`, or has a bullet with no citation.
    """
    issues: list[Issue] = []
    for page in pages_by_id.values():
        if page.fm.get("type") not in SOURCE_TYPES:
            continue
        if "新认知" not in page.sections:
            issues.append(("error", page.relpath, "missing required section ## 新认知"))
            continue
        for bullet in insight_bullets(page):
            if not find_citations(bullet):
                issues.append(("error", page.relpath, f"新认知 entry has no anchor: {bullet[:40]}"))
    return issues


def check_insight_count(pages_by_id: dict[str, Page]) -> list[Issue]:
    """warn: a source page's `## 新认知` bullet count is outside [3, 10]."""
    issues: list[Issue] = []
    for page in pages_by_id.values():
        if page.fm.get("type") not in SOURCE_TYPES:
            continue
        count = len(insight_bullets(page))
        if count == 0:
            continue  # already reported as an error by check_insights
        if not (MIN_INSIGHTS <= count <= MAX_INSIGHTS):
            issues.append(
                ("warn", page.relpath, f"新认知 has {count} entries, expected {MIN_INSIGHTS}-{MAX_INSIGHTS}")
            )
    return issues


def check_alias_collision(pages_by_id: dict[str, Page]) -> list[Issue]:
    """warn: two concepts share a title or alias, case-insensitively
    (likely duplicate concepts that should be merged via `redirect_to`).
    """
    issues: list[Issue] = []
    names: dict[str, list[str]] = {}
    for page in pages_by_id.values():
        if page.fm.get("type") != "concept":
            continue
        candidates = [page.fm.get("title")] + list(page.fm.get("aliases") or [])
        for name in candidates:
            if not isinstance(name, str) or name == "":
                continue
            names.setdefault(name.casefold(), []).append(page.relpath)

    seen_pairs: set[tuple[str, str]] = set()
    for relpaths in names.values():
        distinct = sorted(set(relpaths))
        if len(distinct) < 2:
            continue
        for i in range(len(distinct)):
            for j in range(i + 1, len(distinct)):
                pair = (distinct[i], distinct[j])
                if pair in seen_pairs:
                    continue
                seen_pairs.add(pair)
                issues.append(
                    ("warn", pair[0], f"concept title/alias collides with {pair[1]}（别名冲突）")
                )
    return issues


def page_body_link_targets(pages_by_id: dict[str, Page], redirects: dict[str, str], page: Page) -> set[str]:
    """Every other wiki page id that `page`'s body links to via a
    relative `.md` link, redirects followed.
    """
    targets: set[str] = set()
    for _text, href in extract_md_links(page.body):
        resolved = resolve_link(page.id, href)
        if resolved is None:
            continue
        target_id = follow_redirects(redirects, resolved[0])
        if target_id in pages_by_id:
            targets.add(target_id)
    return targets


def build_edges(pages_by_id: dict[str, Page], redirects: dict[str, str]) -> list[tuple[str, str]]:
    """`(from_id, to_id)` for every valid `relations` entry (edges whose
    target doesn't exist are skipped here — `check_relation_targets`
    already reports those as errors).
    """
    edges: list[tuple[str, str]] = []
    for page in pages_by_id.values():
        if page.fm.get("type") == "raw":
            continue
        for relation in page.fm.get("relations") or []:
            if not isinstance(relation, dict):
                continue
            try:
                target_id = resolve_relation_target(relation)
            except ValueError:
                continue
            resolved = follow_redirects(redirects, target_id)
            if resolved in pages_by_id:
                edges.append((page.id, resolved))
    return edges


def check_orphans(pages_by_id: dict[str, Page], redirects: dict[str, str]) -> list[Issue]:
    """warn: a page has no incoming relation edge and is not linked from
    any other wiki page's body. `type: raw` pages, redirect sources (not
    loaded as regular pages), and topics with `root: true` are exempt.
    """
    edges = build_edges(pages_by_id, redirects)
    incoming = {to_id for _from_id, to_id in edges}

    linked_from_body: set[str] = set()
    for page in pages_by_id.values():
        for target_id in page_body_link_targets(pages_by_id, redirects, page):
            if target_id != page.id:
                linked_from_body.add(target_id)

    issues: list[Issue] = []
    for page in sorted(pages_by_id.values(), key=lambda p: p.relpath):
        if page.fm.get("type") == "raw":
            continue
        if page.fm.get("type") == "topic" and page.fm.get("root") is True:
            continue
        if page.id in incoming or page.id in linked_from_body:
            continue
        issues.append(("warn", page.relpath, "orphan page: no incoming relation and not linked from any page"))
    return issues


def check_index_coverage(pages_by_id: dict[str, Page], redirects: dict[str, str]) -> list[Issue]:
    """warn: a page is not linked from `wiki/index.md` (a relative link
    there must resolve to it). `type: raw` pages and redirect sources are
    exempt — `wiki/index.md` itself, being `raw`, is exempt from needing
    to link itself.
    """
    index_page = pages_by_id.get("wiki/index")

    linked_ids: set[str] = set()
    if index_page is not None:
        for _text, href in extract_md_links(index_page.body):
            resolved = resolve_link(index_page.id, href)
            if resolved is not None:
                linked_ids.add(follow_redirects(redirects, resolved[0]))

    issues: list[Issue] = []
    for page in sorted(pages_by_id.values(), key=lambda p: p.relpath):
        if page.fm.get("type") == "raw":
            continue
        if page.id in linked_ids:
            continue
        issues.append(("warn", page.relpath, "page is not linked from wiki/index.md"))
    return issues


def check_missing_source_dirs(root: Path, pages_by_id: dict[str, Page]) -> list[Issue]:
    """warn: a directory under `sources/{papers,blogs,videos,podcasts}/`
    (at the per-item depth, e.g. `sources/papers/<arxiv-id>`) has no wiki
    page whose `source_dir` points to it, and it isn't listed in
    `sources/skipped.txt`.
    """
    sources_dir = root / "sources"
    if not sources_dir.is_dir():
        return []

    skipped_path = sources_dir / "skipped.txt"
    skipped: set[str] = set()
    if skipped_path.is_file():
        skipped = {line.strip() for line in skipped_path.read_text(encoding="utf-8").splitlines() if line.strip()}

    referenced: set[str] = set()
    for page in pages_by_id.values():
        source_dir = page.fm.get("source_dir")
        if isinstance(source_dir, str):
            referenced.add(source_dir.rstrip("/"))

    issues: list[Issue] = []
    for category_dir in sorted(sources_dir.iterdir()):
        if not category_dir.is_dir():
            continue
        item_dirs = _leaf_source_dirs(category_dir)
        for item_dir in item_dirs:
            source_dir = item_dir.relative_to(root).as_posix()
            if source_dir in referenced:
                continue
            if source_dir in skipped or item_dir.name in skipped:
                continue
            issues.append(("warn", source_dir, "sources/ directory has no page pointing to it via source_dir"))
    return issues


def _leaf_source_dirs(category_dir: Path) -> list[Path]:
    """Directories under a `sources/<category>/` tree that themselves
    contain a source file (`meta.yaml`/`anchors.md`/`transcript.md`) —
    i.e. the actual per-item directories, at whatever depth
    (`sources/papers/<id>` or `sources/blogs/<org>/<slug>`).
    """
    markers = {"meta.yaml", "anchors.md", "transcript.md"}
    leaves: list[Path] = []
    for dirpath in sorted(category_dir.rglob("*")):
        if not dirpath.is_dir():
            continue
        if any((dirpath / marker).exists() for marker in markers):
            leaves.append(dirpath)
    return leaves


PREDICTION_HEADING = "可验证的预测"
TABLE_ROW_RE = re.compile(r"^\|(.+)\|\s*$")
YEAR_MONTH_RE = re.compile(r"^\d{4}-\d{2}$")
YEAR_MONTH_DAY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def parse_markdown_table(section_body: str) -> tuple[list[str], list[list[str]]]:
    """Parse a GFM table at the start of a section body into
    `(header_cells, data_rows)`. Returns `([], [])` when there's no table.
    """
    rows = [
        [cell.strip() for cell in m.group(1).split("|")]
        for line in section_body.split("\n")
        if (m := TABLE_ROW_RE.match(line.strip()))
    ]
    if len(rows) < 2:
        return [], []
    header = rows[0]
    # row[1] is the `---|---` separator row; data starts at row[2].
    return header, rows[2:]


def prediction_expiry_date(due: str) -> date | None:
    """`到期` cell value to a comparable `date`: `YYYY-MM` becomes the
    last day of that month, `YYYY-MM-DD` is used as-is. Returns `None`
    for anything else (not a recognised date format).
    """
    if YEAR_MONTH_DAY_RE.match(due):
        return date.fromisoformat(due)
    if YEAR_MONTH_RE.match(due):
        year, month = (int(part) for part in due.split("-"))
        if month == 12:
            next_month = date(year + 1, 1, 1)
        else:
            next_month = date(year, month + 1, 1)
        return next_month - timedelta(days=1)
    return None


def check_predictions(pages_by_id: dict[str, Page], today: date) -> list[Issue]:
    """warn: a row in a `## 可验证的预测` table has an expired `到期` date
    and `状态` is still `待验证`.
    """
    issues: list[Issue] = []
    for page in sorted(pages_by_id.values(), key=lambda p: p.relpath):
        section = page.sections.get(PREDICTION_HEADING)
        if section is None:
            continue
        header, data_rows = parse_markdown_table(section)
        if not header:
            continue
        try:
            due_idx = header.index("到期")
            status_idx = header.index("状态")
        except ValueError:
            continue

        for row in data_rows:
            if len(row) <= max(due_idx, status_idx):
                continue
            due_date = prediction_expiry_date(row[due_idx])
            if due_date is None:
                continue
            if due_date < today and row[status_idx] == "待验证":
                issues.append(
                    ("warn", page.relpath, f"prediction expired ({row[due_idx]}) and still 待验证: {row[0][:40]}")
                )
    return issues


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


def lint(root: Path, ci: bool = False, today: date | None = None) -> list[Issue]:
    """Run every check against the wiki rooted at `root` (a directory
    containing `wiki/` and `sources/`). `ci` skips the `.cache/` full-text
    verification. `today` defaults to the real current date; tests pass a
    fixed value so prediction-expiry checks are deterministic.
    """
    if today is None:
        today = date.today()

    root = Path(root).resolve()
    pages, filename_errors = load_pages(root)
    pages_by_id = {page.id: page for page in pages if page.fm.get("redirect_to") is None}
    redirects = build_redirects({page.id: page for page in pages})

    issues: list[Issue] = []
    for msg in filename_errors:
        # the message already embeds the relpath after the final colon.
        relpath = msg.rsplit(": ", 1)[-1]
        issues.append(("error", relpath, msg))

    issues += check_relation_targets(pages_by_id, redirects)
    issues += check_anchors_exist(root, pages_by_id, redirects)
    issues += check_cache_fulltext(root, pages_by_id, ci)
    issues += check_append_only(root)
    issues += check_insights(pages_by_id)
    issues += check_summary_length(pages_by_id)
    issues += check_insight_count(pages_by_id)
    issues += check_alias_collision(pages_by_id)
    issues += check_orphans(pages_by_id, redirects)
    issues += check_index_coverage(pages_by_id, redirects)
    issues += check_missing_source_dirs(root, pages_by_id)
    issues += check_predictions(pages_by_id, today)

    return sorted(issues, key=lambda issue: (issue[1], issue[0], issue[2]))


def main(argv: list[str] | None = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Lint the wiki for anchors, append-only sources, and content quality.")
    parser.add_argument("--ci", action="store_true", help="skip .cache/ full-text verification")
    parser.add_argument("--root", default=None, help="repo root (default: two levels up from this script)")
    args = parser.parse_args(argv)

    root = Path(args.root) if args.root else Path(__file__).resolve().parent.parent
    issues = lint(root, ci=args.ci)

    for level, path, msg in issues:
        icon = "🔴" if level == "error" else "🟡"
        print(f"{icon} {path}: {msg}")

    error_count = sum(1 for level, _, _ in issues if level == "error")
    warn_count = sum(1 for level, _, _ in issues if level == "warn")
    print(f"{error_count} errors, {warn_count} warnings")

    return 1 if error_count > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
