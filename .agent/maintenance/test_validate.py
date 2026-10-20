"""Негативні та позитивні перевірки валідатора на тимчасових копіях."""

from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

import validate as validator


class BundleValidationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="agent-rules-test-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        source = Path(__file__).resolve().parents[2]
        for relative in validator.REQUIRED_FILES:
            destination = self.root / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            if relative in ("README.md", "README.ua.md", "LICENSE"):
                destination.write_text("# Тестовий документ бібліотеки\n", encoding="utf-8")
            elif relative == ".agent/project/PROJECT_CONTEXT.md":
                destination.write_text(self.context_template(), encoding="utf-8")
            elif relative == ".agent/project/CODE_STYLE.md":
                destination.write_text(self.style_template(), encoding="utf-8")
            elif (source / relative).is_file():
                shutil.copyfile(source / relative, destination)
            else:
                self.fail(f"Відсутній файл комплекту: {relative}")
        for relative in ("docs/admin-restoration.md", "docs/statistics-contract.md"):
            destination = self.root / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text("# Синтетичне джерело посилання\n", encoding="utf-8")
    def edit(self, relative, transform):
        path = self.root / relative
        path.write_text(transform(path.read_text(encoding="utf-8-sig")), encoding="utf-8")

    def project(self):
        for relative in (".agent/project/PROJECT_CONTEXT.md", ".agent/project/CODE_STYLE.md"):
            self.edit(relative, lambda value: value.replace("[FILL_PER_PROJECT]", "не застосовується: тестовий документ"))
        self.edit(".agent/project/PROJECT_CONTEXT.md", lambda value: value.replace(
            "profile: template", "profile: project").replace(
            "git_enabled: не застосовується: тестовий документ", "git_enabled: false").replace(
            "потребує перевірки: що саме", "невідоме: що саме"))

    def errors(self, mode="template"):
        return validator.validate(self.root, mode)[0]

    def context_template(self):
        """Синтетичний профіль; не читає контекст цільового продукту."""
        values = {name: "[FILL_PER_PROJECT]" for name in validator.CONTEXT_FIELDS}
        values["profile"] = "template"
        return "# Тестовий контекст\n\n" + "".join(
            f"{name}: {value}\n" for name, value in values.items())

    def style_template(self):
        return "# Тестовий стиль\n\n" + "".join(
            f"{name}: [FILL_PER_PROJECT]\n" for name in validator.STYLE_FIELDS)


    def test_template_is_valid(self):
        self.assertEqual([], self.errors())

    def test_cli_outputs_utf8(self):
        result = subprocess.run(
            [sys.executable, "-B", str(self.root / ".agent/maintenance/validate.py"),
             "--root", str(self.root), "--mode", "template"],
            capture_output=True, encoding="utf-8", timeout=15, check=False)
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIn("OK:", result.stdout)
        self.assertIn("Перевірено", result.stdout)

    def test_cli_rejects_unconfigured_project(self):
        result = subprocess.run(
            [sys.executable, "-B", str(self.root / ".agent/maintenance/validate.py"),
             "--root", str(self.root), "--mode", "project"],
            capture_output=True, encoding="utf-8", timeout=15, check=False)
        self.assertEqual(1, result.returncode, result.stderr)
        self.assertIn("FAIL:", result.stdout)

    def test_template_cannot_claim_project_readiness(self):
        self.assertTrue(self.errors("project"))

    def test_configured_project_is_valid(self):
        self.project()
        self.assertEqual([], self.errors("project"))

    def test_install_does_not_require_bundle_readmes_or_license(self):
        self.project()
        for name in ("README.md", "README.ua.md", "LICENSE"):
            (self.root / name).unlink()
        self.edit("AGENTS.md", lambda text: text + "\n[Місцеве правило](product-policy.md)\n")
        self.assertEqual([], self.errors("project"))

    def test_missing_security_file_fails(self):
        (self.root / ".agent/core/SECURITY_RULES.md").unlink()
        self.assertTrue(any("SECURITY_RULES" in item for item in self.errors()))

    def test_extended_placeholder_is_rejected(self):
        self.project()
        self.edit(".agent/project/CODE_STYLE.md", lambda value: value + "\n[FILL_PER_PROJECT or Not used in this repo.]\n")
        self.assertTrue(any("маркери" in item for item in self.errors("project")))

    def test_unknown_is_rejected(self):
        self.project()
        self.edit(".agent/project/CODE_STYLE.md", lambda value: value + "\nпотребує перевірки: стиль\n")
        self.assertTrue(self.errors("project"))

    def test_missing_field_is_rejected(self):
        self.edit(".agent/project/PROJECT_CONTEXT.md", lambda value: re.sub(r"^stack:.*\n", "", value, flags=re.M))
        self.assertTrue(any("поле stack" in item for item in self.errors()))

    def test_duplicate_field_is_rejected(self):
        self.edit(".agent/project/PROJECT_CONTEXT.md", lambda value: value + "\nstack: інше\n")
        self.assertTrue(any("повторене" in item for item in self.errors()))

    def test_empty_reason_is_rejected(self):
        self.project()
        self.edit(".agent/project/CODE_STYLE.md", lambda value: value.replace(
            "active_languages: не застосовується: тестовий документ", "active_languages: не застосовується:"))
        self.assertTrue(any("причини" in item for item in self.errors("project")))

    def test_broken_link_is_rejected(self):
        self.edit("README.md", lambda value: value + "\n[Перевірка](missing.md)\n")
        self.assertTrue(any("посилання" in item for item in self.errors()))

    def test_escaping_link_is_rejected(self):
        self.edit("README.md", lambda value: value + "\n[Перевірка](../outside.md)\n")
        self.assertTrue(any("за межі" in item for item in self.errors()))

    def test_installed_template_is_valid_without_library_documents(self):
        for name in ("README.md", "README.ua.md", "LICENSE"):
            (self.root / name).unlink()
        self.assertEqual([], self.errors("installed"))
        self.assertTrue(self.errors("project"))

    def test_installed_cli_discloses_profile_limit(self):
        result = subprocess.run(
            [sys.executable, "-B", str(self.root / ".agent/maintenance/validate.py"),
             "--root", str(self.root), "--mode", "installed"],
            capture_output=True, encoding="utf-8", timeout=15, check=False)
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIn("не підтверджує", result.stdout)

    def test_installed_project_keeps_unknown_field_gate(self):
        self.project()
        self.edit(".agent/project/CODE_STYLE.md", lambda text: text + "\nUNKNOWN\n")
        self.assertTrue(self.errors("installed"))

if __name__ == "__main__":
    unittest.main()
