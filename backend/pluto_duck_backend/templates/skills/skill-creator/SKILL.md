---
name: skill-creator
description: Guide for creating new Pluto Duck skills (SKILL.md) and safely scaffolding skill folders under /skills/. Use when the user asks to create/make/build/scaffold/initialize a skill, or to update/validate an existing skill definition.
---

# Skill Creator (Pluto Duck Backend)

This skill guides you in creating and maintaining skills for Pluto Duck's deep agent.

## Where skills live (virtual paths)

Skills are stored under `/skills/`:

- **User skills (shared across projects)**: `/skills/user/skills/<skill-name>/SKILL.md`
- **Project skills (override user skills)**: `/skills/projects/<project_id>/skills/<skill-name>/SKILL.md`

## Important constraints (backend mode)

- Script execution is not available. Do NOT instruct running `python`/`bash` scripts to generate skills.
- Creating/updating skills requires file writes/edits, which may require human approval (HITL).

## Anatomy of a skill

Each skill is a folder containing a required `SKILL.md` file:

```
/skills/user/skills/<skill-name>/
  SKILL.md
  references/   (optional)
  assets/       (optional)
  scripts/      (optional, but not executable in backend mode)
```

### SKILL.md structure

1. **YAML frontmatter** (required):
   - `name`: must match folder name (lowercase letters/numbers/hyphens)
   - `description`: must clearly describe when to use this skill (this is the primary trigger)
2. **Body** (markdown):
   - step-by-step workflow
   - tool usage guidance
   - links to any bundled reference files

## Skill creation process (no scripts)

### Step 1: Clarify usage examples

Ask for 2-5 concrete examples of user requests that should trigger the skill.
Keep questions minimal; start with the most important.

### Step 2: Design the workflow

Decide:
- what the agent should do first (schema discovery? read existing artifacts?)
- what tools it should call (Pluto Duck domain tools vs filesystem tools)
- what artifacts to write under `/workspace/` (intermediate) vs `/memories/` or `/skills/` (long-term)

### Step 3: Scaffold the folder + SKILL.md

Create:
1. Skill folder: `/skills/user/skills/<skill-name>/`
2. `SKILL.md` with valid frontmatter
3. Optional subfolders `references/`, `assets/`

Use `write_file` to create files and `ls` to verify the structure.

### Step 4: Validate quickly

Without scripts, validation is manual:
- Confirm folder name matches frontmatter `name`
- Confirm description is specific (contains triggers/contexts)
- Confirm body is actionable (imperative steps, clear tool usage)
- Ensure any referenced files exist under the same skill folder

### Step 5: Iterate

After real usage, refine:
- triggers in description (to reduce false positives/negatives)
- workflow steps (to reduce wasted tool calls)
- add references for large, detailed content instead of bloating SKILL.md


