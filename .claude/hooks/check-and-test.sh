#!/usr/bin/env bash
# Stop hook: keeps the agent working until `npm run check && npm test` pass.
# Exit 2 with the failing output on stderr blocks the stop and shows it to Claude.
# When Claude is already continuing because of this hook (stop_hook_active), let it stop,
# so a failure it cannot fix never loops.

input=$(cat)
if printf '%s' "$input" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
	exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

if ! out=$(npm run --silent check 2>&1 && npm test --silent 2>&1); then
	{
		echo 'Stop hook: `npm run check && npm test` failed. Fix this before finishing:'
		echo
		printf '%s\n' "$out" | tail -n 80
	} >&2
	exit 2
fi
