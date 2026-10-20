# Стан поточної задачі

Задача: разове спрощення агентських правил за дорученням Валерія від 2026-10-20.
Статус: Done.
Дозволені файли: AGENTS.md, HANDOFF.md, .gitignore;
.codex/hooks.json, continuity.json, .continuity-*.tmp, config.toml, agents/frontend_engineer.toml, agents/frontend_pevisor.toml;
.agent/maintenance/{validate.py,test_validate.py,continuity_hook.py,test_continuity_hook.py};
.agent/AGENTS.md, core/{CONTINUITY,REVIEW,WORK_BUDGET,WORK_SCOPE,AUTO_CHECKLIST,DEFINITION_OF_DONE,TASK_OUTPUT_FORMAT}.md;
.agent/{adapters/CODEX.md,profiles/ROLES.md,CHANGELOG*,COMPLIANCE_CHECKLIST*}, maintenance/{INSTALL*,SCENARIOS*,SOURCES*,VALIDATION_REPORT*};
.agent/core/{SECURITY_RULES,GIT_WORKFLOW,PRINCIPLES}.md, .agent/project/{PROJECT_CONTEXT,CODE_STYLE}.md.
Зроблено: правила зведено до AGENTS.md; автоматичний стан, хук і окрему роль перевірки прибрано; валідатор адаптовано.
Перевірки: валідатор OK (6 документів); unittest OK (17 тестів); npm run test — 654 успішні, 9 пропущено.
Код сайту й три наявні зміни deploy/production збережено; коміт, push і deploy не виконувалися.
Залишилось: рішення власника про окремі коміти; історичні згадки видаленої точки входу в трьох docs-файлах поза дозволеним обсягом не змінено.
