"""Prompt templates for the Pluto Duck deep agent."""

from __future__ import annotations

from importlib import resources


def load_prompt(filename: str, *, encoding: str = "utf-8") -> str:
    package = __name__
    resource = resources.files(package).joinpath(filename)
    with resources.as_file(resource) as path:
        return path.read_text(encoding=encoding)


def load_default_agent_prompt() -> str:
    return load_prompt("default_agent_prompt.md")


