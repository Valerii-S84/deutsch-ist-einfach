"""Run selected unmodified backend pure calculations on synthetic controls.
No backend imports, network, database or environment credentials are used.
This is deliberately not a SQL/auth integration test.
"""
import ast
import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

snapshot = json.loads((Path(__file__).resolve().parents[1] / "docs/statistics-fixtures/backend-formulas-source.json").read_text(encoding="utf-8"))
namespace = dict(datetime=datetime, timedelta=timedelta, Decimal=Decimal, dataclass=dataclass,
                 defaultdict=defaultdict, CohortsResponse=SimpleNamespace,
                 _level_sort_key=lambda level: level)
selected = {"build_kpi", "OverviewWindows", "build_windows", "_safe_pct", "_completion_rate",
            "_percentile", "_build_level_stats", "_build_mode_level_distribution", "build_cohorts_response"}
for path, source in snapshot["sources"].items():
    tree = ast.parse(source)
    nodes = [node for node in tree.body if isinstance(node, (ast.FunctionDef, ast.ClassDef)) and node.name in selected]
    if not nodes:
        continue
    module = ast.Module(body=[ast.ImportFrom(module="__future__", names=[ast.alias(name="annotations")], level=0), *nodes], type_ignores=[])
    ast.fix_missing_locations(module)
    exec(compile(module, path, "exec"), namespace)

checks = 0
def check(actual, expected):
    global checks
    assert actual == expected, (actual, expected)
    checks += 1

check(namespace["build_kpi"](current=3, previous=2), {"current": 3, "previous": 2, "delta_pct": 50.0})
check(namespace["build_kpi"](current=0, previous=0)["delta_pct"], 0)
check(namespace["build_kpi"](current=2, previous=0)["delta_pct"], 100)
check(namespace["_safe_pct"](1, 4), 25)
check(namespace["_safe_pct"](1, 0), 0)
check(namespace["_completion_rate"](completed=3, created=2), 150)
check(namespace["_completion_rate"](completed=0, created=0), 0)
now = datetime(2026, 4, 10, 12, tzinfo=timezone.utc)
for days in (7, 30, 90):
    windows = namespace["build_windows"](now_utc=now, days=days)
    check((windows.current_start, windows.previous_start, windows.previous_end, windows.current_end),
          (now - timedelta(days=days), now - timedelta(days=days * 2), now - timedelta(days=days), now))
check(namespace["_percentile"]([], .95), None)
check(namespace["_percentile"]([10, 50, 20, 30, 40], .5), 30)
check(namespace["_percentile"]([10, 50, 20, 30, 40], .95), 50)
check(namespace["_build_level_stats"]([("A1", 2)], [("A1", 5)]), [{"level": "A1", "total_questions": 2, "attempts": 5, "coverage_percent": 250.0}])
check(namespace["_build_level_stats"]([("A1", 2)], [])[0]["coverage_percent"], 0)
distribution = namespace["_build_mode_level_distribution"]([("MIX", "A1", 3), ("MIX", "A2", 1), ("DAILY", "B1", 6)])
check(next(row for row in distribution if row["level"] == "A1")["percent_in_mode"], 75)
check(next(row for row in distribution if row["level"] == "A1")["percent_of_all_attempts"], 30)
rows = SimpleNamespace(user_rows=[(1, now), (2, now)], purchase_rows=[(1, now), (1, now), (1, now + timedelta(days=7))])
cohort = namespace["build_cohorts_response"](rows).cohorts[0]
check(cohort["users"], 2)
check(cohort["w0"], 50)
check(cohort["w1"], 50)
check(cohort["w8"], 0)  # Backend does not distinguish immature weeks.
print(f"PASS: {checks} pure backend controls; source commit {snapshot['commit']}; no SQL/RBAC/integration claim")
