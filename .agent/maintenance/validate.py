"""Перевіряє структуру набору; не виконує команди проєкту чи мережеві запити."""

import argparse
import math
from pathlib import Path
import re
import sys
from urllib.parse import unquote


REQUIRED_FILES = (
    "AGENTS.md", "README.md", "README.ua.md", "LICENSE",
    ".agent/AGENTS.md", ".agent/CHANGELOG.md", ".agent/COMPLIANCE_CHECKLIST.md",
    ".agent/core/WORK_SCOPE.md", ".agent/core/WORK_BUDGET.md",
    ".agent/core/SECURITY_RULES.md", ".agent/core/DEFINITION_OF_DONE.md",
    ".agent/core/GIT_WORKFLOW.md", ".agent/core/PRINCIPLES.md",
    ".agent/core/TASK_OUTPUT_FORMAT.md", ".agent/core/AUTO_CHECKLIST.md",
    ".agent/project/PROJECT_CONTEXT.md", ".agent/project/CODE_STYLE.md",
    ".agent/adapters/CODEX.md", ".agent/maintenance/SOURCES.md",
    ".agent/maintenance/SCENARIOS.md", ".agent/maintenance/VALIDATION_REPORT.md",
    ".agent/maintenance/INSTALL.md",
    ".agent/maintenance/validate.py", ".agent/maintenance/test_validate.py",
    ".agent/profiles/ROLES.md",
)
CONTEXT_FIELDS = (
    "profile", "project_name", "stack", "user_language", "source_paths", "test_paths",
    "protected_paths", "fact_sources", "test_command", "lint_command", "build_command",
    "run_command", "command_notes", "external_dependencies", "production_boundaries",
    "approval_required", "secret_locations", "git_enabled", "protected_branches",
    "commit_policy", "commit_format", "merge_strategy", "agent_adapter", "budget_unit",
    "budget_limit", "budget_measurement", "budget_scope", "delegation",
)
STYLE_FIELDS = (
    "active_languages", "style_sources", "formatters_linters", "test_conventions",
    "migration_conventions", "numeric_limits",
)
BUDGET_FIELDS = ("budget_unit", "budget_limit", "budget_measurement", "budget_scope")
REVIEW_DEFAULTS = {
    "role_mode": "auto", "review_mode": "risk_based",
    "review_triggers": "не застосовується: додаткові умови не задані",
    "review_executor": "unspecified",
}
REVIEW_CHOICES = {
    "role_mode": ("auto", "explicit"),
    "review_mode": ("risk_based", "self", "separate"),
    "review_executor": ("user", "separate_agent", "unspecified"),
}
UNKNOWN = re.compile(r"FILL_PER_PROJECT|потребує перевірки|\b(?:TODO|TBD|UNKNOWN)\b", re.I)
FIELD = re.compile(r"^([a-z_]+):[ \t]*(.*)$", re.M)
LINK = re.compile(r"\[[^\]\n]+\]\(([^)\s]+)\)")


def parse_fields(content, names, label, errors):
    """Відхиляє пропущені й неоднозначно повторені поля без виводу значень."""
    fields = {}
    for name, value in FIELD.findall(content):
        if name in names:
            if name in fields:
                errors.append(f"{label}: повторене поле {name}")
            fields[name] = value.strip()
    for name in names:
        if not fields.get(name):
            errors.append(f"{label}: відсутнє або порожнє поле {name}")
    return fields


def not_applicable(value):
    return value.lower().startswith("не застосовується:")


def validate(root, mode):
    root = Path(root).resolve()
    errors = []
    documents = {}
    required = [name for name in REQUIRED_FILES if mode == "template" or name == "AGENTS.md" or name.startswith(".agent/")]
    for relative in required:
        candidate = root / relative
        if not candidate.resolve().is_relative_to(root):
            errors.append(f"{relative}: шлях виходить за межі набору")
            continue
        if not candidate.is_file():
            errors.append(f"{relative}: файл відсутній")
            continue
        if candidate.suffix == ".md":
            try:
                documents[relative] = candidate.read_text(encoding="utf-8-sig")
            except (OSError, UnicodeError):
                errors.append(f"{relative}: неможливо прочитати як UTF-8")

    for relative, content in documents.items():
        if relative == "AGENTS.md":
            continue  # Місцеві посилання продукту не належать до цього набору.
        for target in LINK.findall(content):
            if target.startswith(("https://", "http://", "#")):
                continue
            path = (root / relative).parent / unquote(target.split("#", 1)[0])
            if not path.resolve().is_relative_to(root):
                errors.append(f"{relative}: локальне посилання виходить за межі набору")
            elif not path.is_file():
                errors.append(f"{relative}: відсутній файл локального посилання {target}")

    entry = documents.get(".agent/AGENTS.md", "")
    version = re.search(r"^bundle_version: (\d+\.\d+\.\d+)$", entry, re.M)
    change = re.search(r"^## (\d+\.\d+\.\d+) ", documents.get(".agent/CHANGELOG.md", ""), re.M)
    if not version or not change or version[1] != change[1]:
        errors.append("Версія точки входу не збігається з першим записом історії")
    if ".agent/AGENTS.md" not in documents.get("AGENTS.md", ""):
        errors.append("Коренева точка входу не підключає .agent/AGENTS.md")

    context_name = ".agent/project/PROJECT_CONTEXT.md"
    style_name = ".agent/project/CODE_STYLE.md"
    context = parse_fields(documents.get(context_name, ""), CONTEXT_FIELDS, context_name, errors)
    present_review = {name for name, _ in FIELD.findall(documents.get(context_name, ""))
                      if name in REVIEW_DEFAULTS}
    review = {**REVIEW_DEFAULTS, **parse_fields(documents.get(context_name, ""),
                                              present_review, context_name, errors)}
    context.update(review)
    for name, choices in REVIEW_CHOICES.items():
        if review[name] not in choices:
            errors.append(f"{name}: непідтримуване налаштування ролі або рев'ю")
    style = parse_fields(documents.get(style_name, ""), STYLE_FIELDS, style_name, errors)
    if context.get("profile") != mode:
        errors.append("Профіль контексту не відповідає режиму перевірки")
    if mode == "project":
        separate_required = (review["review_mode"] == "separate"
                             or not not_applicable(review["review_triggers"]))
        if separate_required and review["review_executor"] == "unspecified":
            errors.append("review_executor: обов'язкове окреме рев'ю потребує виконавця")
        for name in (context_name, style_name):
            if UNKNOWN.search(documents.get(name, "")):
                errors.append(f"{name}: залишились маркери або невідомі налаштування")
        for name, value in {**context, **style}.items():
            if value.lower().startswith("не застосовується"):
                if not not_applicable(value) or not value.partition(":")[2].strip():
                    errors.append(f"Поле {name}: незастосовність потребує причини після двокрапки")
        if context.get("git_enabled") not in ("true", "false"):
            errors.append("git_enabled: потрібне true або false")
        absent = [not_applicable(context.get(name, "")) for name in BUDGET_FIELDS]
        if any(absent) and not all(absent):
            errors.append("Бюджет: заповни всі чотири поля або познач усі незастосовними")
        elif not any(absent):
            try:
                limit = float(context.get("budget_limit", ""))
                if not math.isfinite(limit) or limit <= 0:
                    raise ValueError
            except ValueError:
                errors.append("budget_limit: потрібне скінченне додатне число")
    return errors, documents


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd(), help="Корінь набору")
    parser.add_argument("--mode", choices=("template", "project"), required=True,
                        help="Шаблон або повністю налаштований проєкт")
    args = parser.parse_args()
    errors, documents = validate(args.root, args.mode)
    if errors:
        print("FAIL: перевірка комплекту")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"OK: документів {len(documents)}; режим {args.mode}")
    print("Перевірено форму й локальні посилання, не поведінку моделі або істинність команд.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
