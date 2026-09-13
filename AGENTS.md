# Правила роботи в репозиторії

Прочитай [точку входу](.agent/AGENTS.md) та застосуй її до задачі.
Шляхи в наборі відраховуються від кореня репозиторію, якщо не зазначено інше.
Враховуй також чинні інструкції середовища та правила директорій, яких стосується задача.
Не скануй сторонні каталоги в пошуках правил.

## Критичні вимоги адміністративного контролю

Адміністративна статистика та збереження контролю власника над продуктами — критичні вимоги. Рефакторинг, відокремлення або перейменування не дозволяють видаляти адміністративні можливості, метрики чи доступ до них без прямого дозволу власника. Перенесення функції завершене лише після перевірки її доступності та правильності в новому місці. Подальші зміни повинні зберігати й перевіряти статистику всіх підключених продуктів.

Карта продуктів, аудит втрат, контракт інтеграції та критерії приймання: [адміністративний контроль](docs/admin-restoration.md). Для змін адмінки й статистики прочитай також [контракти метрик](docs/statistics-contract.md).

TASK AND CONTEXT DISCIPLINE

\- One task/thread must have one narrow objective. Do not expand a task with an independent objective. Finish the current task with a repository result and handoff, then use a new task/thread for the next independent objective.

\- Read required governing files once per task/thread and retain their applicable rules in working context. Do not reread an unchanged file in the same task unless an exact passage is required, the file may have changed, or context loss makes the prior read unavailable.

\- Do not poll or call \`wait\` without a necessary already-running operation. Use an appropriate timeout in the original call, avoid short repeated waits, and stop waiting when the user asks for the requested action directly.

\- Do not rerun a successful test or check unless a relevant implementation or test artifact changed after that successful run, or the user explicitly requests the rerun. A commit alone is not a reason to rerun tests.

\- Batch independent read-only shell checks into one orchestrated tool call. Minimize model/tool round trips, especially when the conversation context is large.

\- Do not run \`git status\`, diff checks, tests, validation, or other diagnostics "just in case". Run a check only when it is directly required to scope an authorized write, diagnose an observed problem, satisfy an acceptance gate, or produce evidence explicitly requested by the user.

\- Use \`/status\` at task boundaries and before an expensive multi-step task when the interface provides it.

EXECUTION PLANNING PROTOCOL — REQUIRED BEFORE TOOL USE

\- Before the first tool call, state a short execution plan containing: the one narrow objective, explicit non-goals, governing authority, files expected to change, the exact verification command or evidence gate, and the maximum planned model passes.

\- Define completion in observable terms before starting, for example an exact test count plus \`OK\`, a named artifact plus a validation result, or a successful commit of an explicit file whitelist. Do not use open-ended goals such as "improve", "investigate everything", or "make tests better" without a bounded gate.

\- Estimate \`current context tokens × planned model passes\` before tooling. If the estimate does not fit the active budget, reduce reads and passes, or stop with \`BUDGET LIMIT\` before spending the budget.

\- Reuse established repository state and exact user handoffs. Do not rediscover architecture, recompute known evidence, or reread unchanged governing files unless the current decision requires an exact passage, the files may have changed, or context loss removed the prior read.

\- Read only the minimum authoritative material needed to choose the implementation. Prefer targeted sections, parsed projections, names, counts, hashes, and bounded excerpts over full large files, minified workflow JSON, generated HTML, or repository-wide discovery.

\- Batch independent reads and predictable dependent mechanical steps into the fewest safe orchestrated tool calls. Set a sufficient timeout and bounded output on the original call so avoidable polling, truncation, and transport retries do not consume model passes.

\- After the last relevant change, run one verification phase matched to the completion gate. Do not run a full suite when a targeted lane is the approved gate, and do not rerun successful checks when no relevant artifact changed.

\- A failed verification permits one retry only after identifying the concrete cause. Change only the causal scope, explain why the correction addresses that cause, and rerun the same gate once. Random alternative patches or repeated exploratory runs are prohibited.

BUDGET DISCIPLINE — HARD RULE

\- Treat context tokens, model passes, tool calls, execution time, and external calls as a finite project budget. Use the least expensive safe path that is sufficient to complete the user's exact request.

\- Every analysis step, repository search, file read, command, experiment, test, audit, or tool call must unlock a concrete required decision, implementation action, or requested piece of evidence. If it does not, it is prohibited.

\- Do not perform speculative analysis, broad research, exploratory experiments, alternative implementations, extra audits, or "while we are here" investigations unless the user explicitly requests them or they are strictly necessary to unblock the active task.

\- Do not collect more evidence after the requested result is already established. Stop immediately when the narrow task is complete and return the result.

\- Prefer one targeted read over repository-wide discovery, one deterministic check over repeated sampling, and one orchestrated tool call over multiple model/tool round trips.

\- Do not spend budget optimizing, explaining, testing, or documenting work beyond the requested acceptance boundary. When additional work may be useful but is not required, report it as a possible next task without executing it.

\- If a task can be completed safely from already established repository state, use that state. Do not recreate evidence or repeat analysis merely to increase confidence.

\- When \`/status\` shows high context use, do not begin optional work.

\- A narrow task is limited to at most five model passes, including passes caused by tool results, retries, waits, or intermediate responses. A sixth pass requires explicit user approval after reporting why it is necessary and what it will cost.

\- Before tool use, estimate \`current context tokens × planned model passes\`. If the estimate exceeds the task budget, do not start the operation in the current thread. For an independent task, the default hard ceiling is 300,000 total tokens unless the user explicitly sets another budget.

\- Use \`/status\` before starting an independent tool-using task. If the 300,000-token ceiling cannot be met in the current context, require a new thread. Do not spend the budget first and report the overrun afterward.

\- When predictable steps depend on one another, execute them inside one orchestrated tool call where safely possible. Do not return control to the model between status, whitelist validation, staging, commit, or similar mechanical steps unless a human decision is actually required.

\- Limit tool output to the smallest useful evidence, normally no more than 2,000–3,000 tokens or 100–200 lines. Never dump a full minified workflow JSON, full HTML report, large embedded provenance/semantic JSON, or full diff of a large generated file when targeted fields, counts, hashes, or a bounded excerpt answer the task.

\- Allow at most one retry, and only after identifying a concrete failure cause and correcting it. A second retry requires explicit user approval. Polling attempts count as retries/model passes.

\- After the last relevant change, allow one verification phase only. Batch all required independent checks into that phase. Do not separately repeat tests, diff checks, status checks, or validations.

\- Define the task's exact completion condition before the first tool call. Once that condition is met, stop. Post-completion status, verification, explanation, cleanup, optimization, or documentation is prohibited unless explicitly requested or required by an approved acceptance gate.

\- For a request whose complete objective is a Git commit: verify only the exact file whitelist needed to prevent unrelated inclusion; do not rerun already-successful tests when no relevant file changed afterward; do not read a full diff without a concrete need; request known-required Git escalation on the first attempt; and treat successful commit output as sufficient evidence without a post-commit status check.

\- If the task cannot be completed within the approved budget, stop before exceeding it and report exactly: \`BUDGET LIMIT\`, the additional model passes required, the reason, and the cheapest safe alternative. Continue only after explicit user approval.
