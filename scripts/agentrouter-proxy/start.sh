#!/usr/bin/env bash
# Start the AgentRouter sync-Anthropic WAF bypass proxy on :7187
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
if [[ -z "${AGENTROUTER_API_KEY:-}" && -f "$ROOT/../../.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/../../.env"
  set +a
fi
if [[ -z "${AGENTROUTER_API_KEY:-${KEY:-}}" ]]; then
  echo "Set AGENTROUTER_API_KEY (or KEY) before starting the proxy" >&2
  exit 1
fi
export AGENTROUTER_API_KEY="${AGENTROUTER_API_KEY:-$KEY}"
export AGENTROUTER_ANTHROPIC_BASE="${AGENTROUTER_ANTHROPIC_BASE:-https://agentrouter.org}"
exec python3 proxy.py
