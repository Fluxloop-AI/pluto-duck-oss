"""Backend skills loader (vendored from deepagents-cli with path policy changes).

Implements SKILL.md YAML frontmatter parsing and progressive disclosure metadata listing.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import NotRequired, TypedDict

import yaml

logger = logging.getLogger(__name__)

MAX_SKILL_FILE_SIZE = 10 * 1024 * 1024
MAX_SKILL_NAME_LENGTH = 64
MAX_SKILL_DESCRIPTION_LENGTH = 1024


class SkillMetadata(TypedDict):
    name: str
    description: str
    path: str
    source: str  # user|project

    license: NotRequired[str | None]
    compatibility: NotRequired[str | None]
    metadata: NotRequired[dict[str, str] | None]
    allowed_tools: NotRequired[str | None]


def _is_safe_path(path: Path, base_dir: Path) -> bool:
    try:
        resolved_path = path.resolve()
        resolved_base = base_dir.resolve()
        resolved_path.relative_to(resolved_base)
        return True
    except Exception:
        return False


def _validate_skill_name(name: str, directory_name: str) -> tuple[bool, str]:
    if not name:
        return False, "name is required"
    if len(name) > MAX_SKILL_NAME_LENGTH:
        return False, "name exceeds 64 characters"
    if not re.match(r"^[a-z0-9]+(-[a-z0-9]+)*$", name):
        return False, "name must be lowercase alphanumeric with single hyphens only"
    if name != directory_name:
        return False, f"name '{name}' must match directory name '{directory_name}'"
    return True, ""


def _parse_skill_metadata(skill_md_path: Path, source: str) -> SkillMetadata | None:
    try:
        file_size = skill_md_path.stat().st_size
        if file_size > MAX_SKILL_FILE_SIZE:
            return None

        content = skill_md_path.read_text(encoding="utf-8")
        frontmatter_pattern = r"^---\s*\n(.*?)\n---\s*\n"
        match = re.match(frontmatter_pattern, content, re.DOTALL)
        if not match:
            return None

        frontmatter_str = match.group(1)
        try:
            frontmatter_data = yaml.safe_load(frontmatter_str)
        except yaml.YAMLError:
            return None

        if not isinstance(frontmatter_data, dict):
            return None

        name = frontmatter_data.get("name")
        description = frontmatter_data.get("description")
        if not name or not description:
            return None

        directory_name = skill_md_path.parent.name
        is_valid, _ = _validate_skill_name(str(name), directory_name)
        if not is_valid:
            # Warn but continue for backwards compatibility.
            logger.warning("Skill name not spec-compliant: %s (%s)", name, skill_md_path)

        description_str = str(description)
        if len(description_str) > MAX_SKILL_DESCRIPTION_LENGTH:
            description_str = description_str[:MAX_SKILL_DESCRIPTION_LENGTH]

        return SkillMetadata(
            name=str(name),
            description=description_str,
            path=str(skill_md_path),
            source=source,
            license=frontmatter_data.get("license"),
            compatibility=frontmatter_data.get("compatibility"),
            metadata=frontmatter_data.get("metadata"),
            allowed_tools=frontmatter_data.get("allowed-tools"),
        )
    except Exception:
        return None


def _list_skills(skills_dir: Path, source: str) -> list[SkillMetadata]:
    skills_dir = skills_dir.expanduser()
    if not skills_dir.exists():
        return []

    try:
        resolved_base = skills_dir.resolve()
    except Exception:
        return []

    skills: list[SkillMetadata] = []
    for skill_dir in skills_dir.iterdir():
        if not _is_safe_path(skill_dir, resolved_base):
            continue
        if not skill_dir.is_dir():
            continue
        skill_md_path = skill_dir / "SKILL.md"
        if not skill_md_path.exists():
            continue
        if not _is_safe_path(skill_md_path, resolved_base):
            continue
        meta = _parse_skill_metadata(skill_md_path, source=source)
        if meta:
            skills.append(meta)
    return skills


def list_skills(*, user_skills_dir: Path | None = None, project_skills_dir: Path | None = None) -> list[SkillMetadata]:
    all_skills: dict[str, SkillMetadata] = {}
    if user_skills_dir:
        for skill in _list_skills(user_skills_dir, source="user"):
            all_skills[skill["name"]] = skill
    if project_skills_dir:
        for skill in _list_skills(project_skills_dir, source="project"):
            all_skills[skill["name"]] = skill
    return list(all_skills.values())


