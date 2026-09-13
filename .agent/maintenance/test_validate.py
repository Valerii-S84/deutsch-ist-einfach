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
            shutil.copyfile(source / relative, destination)

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

    def test_version_mismatch_is_rejected(self):
        self.edit(".agent/AGENTS.md", lambda value: re.sub(r"^bundle_version:.*$", "bundle_version: 9.0.0", value, flags=re.M))
        self.assertTrue(any("Версія" in item for item in self.errors()))

    def test_missing_role_profiles_is_rejected(self):
        (self.root / ".agent/profiles/ROLES.md").unlink()
        self.assertTrue(any("ROLES.md" in item for item in self.errors()))

    def test_old_project_without_review_fields_remains_valid(self):
        self.project()
        for name in validator.REVIEW_DEFAULTS:
            self.edit(".agent/project/PROJECT_CONTEXT.md", lambda text, name=name:
                      re.sub(rf"^{name}:.*\n", "", text, flags=re.M))
        self.assertEqual([], self.errors("project"))

    def test_invalid_role_mode_is_rejected(self):
        self.edit(".agent/project/PROJECT_CONTEXT.md", lambda text: text.replace("role_mode: auto", "role_mode: arbitrary"))
        self.assertTrue(any("role_mode" in item for item in self.errors()))

    def test_duplicate_review_field_is_rejected(self):
        self.edit(".agent/project/PROJECT_CONTEXT.md", lambda text: text + "\nreview_mode: self\n")
        self.assertTrue(any("повторене поле review_mode" in item for item in self.errors()))

    def test_separate_review_requires_reviewer(self):
        self.project()
        self.edit(".agent/project/PROJECT_CONTEXT.md", lambda text: text.replace("review_mode: risk_based", "review_mode: separate"))
        self.assertTrue(any("review_executor" in item for item in self.errors("project")))

    def test_separate_review_with_user_is_valid(self):
        self.project()
        self.edit(".agent/project/PROJECT_CONTEXT.md", lambda text: text.replace(
            "review_mode: risk_based", "review_mode: separate").replace(
            "review_executor: unspecified", "review_executor: user"))
        self.assertEqual([], self.errors("project"))

    def test_trigger_requires_reviewer_even_in_self_mode(self):
        self.project()
        self.edit(".agent/project/PROJECT_CONTEXT.md", lambda text: re.sub(
            r"^review_triggers:.*$", "review_triggers: зміна авторизації", text.replace(
                "review_mode: risk_based", "review_mode: self"), flags=re.M))
        self.assertTrue(any("review_executor" in item for item in self.errors("project")))

    def test_partial_budget_is_rejected(self):
        self.project()
        self.edit(".agent/project/PROJECT_CONTEXT.md", lambda value: re.sub(
            r"^budget_limit:.*$", "budget_limit: 100", value, flags=re.M))
        self.assertTrue(any("Бюджет" in item for item in self.errors("project")))

    def test_numeric_budget_is_valid(self):
        self.project()
        values = {"budget_unit": "seconds", "budget_limit": "600",
                  "budget_measurement": "монотонний годинник", "budget_scope": "задача і допоміжні процеси"}
        for name, value in values.items():
            self.edit(".agent/project/PROJECT_CONTEXT.md", lambda text, name=name, value=value:
                      re.sub(rf"^{name}:.*$", f"{name}: {value}", text, flags=re.M))
        self.assertEqual([], self.errors("project"))
        self.edit(".agent/project/PROJECT_CONTEXT.md", lambda text: text.replace("budget_limit: 600", "budget_limit: nan"))
        self.assertTrue(any("budget_limit" in item for item in self.errors("project")))


if __name__ == "__main__":
    unittest.main()
