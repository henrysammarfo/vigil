#!/usr/bin/env bash
# Start or reuse local Tor SOCKS for AgentRouter WAF bypass.
# Usage: bash scripts/tor-start.sh && export AGENTROUTER_USE_TOR=1
set -euo pipefail
DATA="${TOR_DATA_DIR:-/tmp/vigil-tor-data}"
RUN="${TOR_RUN_DIR:-/tmp/vigil-tor-run}"
SOCKS_PORT="${TOR_SOCKS_PORT:-9050}"

if curl -sS --max-time 8 --socks5-hostname 127.0.0.1:${SOCKS_PORT} https://api.ipify.org >/dev/null 2>&1; then
  echo "Tor already accepting SOCKS on 127.0.0.1:${SOCKS_PORT}"
  echo "export AGENTROUTER_USE_TOR=1"
  echo "export AGENTROUTER_TOR_SOCKS=socks5h://127.0.0.1:${SOCKS_PORT}"
  exit 0
fi

mkdir -p "$DATA" "$RUN"
TORRC="$RUN/torrc"
cat > "$TORRC" <<EOF
SocksPort 127.0.0.1:${SOCKS_PORT}
DataDirectory ${DATA}
PidFile ${RUN}/tor.pid
Log notice file ${RUN}/tor.log
EOF

if ! command -v tor >/dev/null 2>&1; then
  echo "tor binary missing — install with: sudo apt-get install -y tor" >&2
  exit 1
fi

: > "$RUN/tor.log"
tor -f "$TORRC" >>"$RUN/stdout.log" 2>&1 &
echo "Starting Tor..."
for _ in $(seq 1 60); do
  if grep -q "Bootstrapped 100%" "$RUN/tor.log" 2>/dev/null; then
    echo "Tor ready socks5h://127.0.0.1:${SOCKS_PORT}"
    echo "export AGENTROUTER_USE_TOR=1"
    echo "export AGENTROUTER_TOR_SOCKS=socks5h://127.0.0.1:${SOCKS_PORT}"
    exit 0
  fi
  sleep 1
done
echo "Tor bootstrap timed out — see $RUN/tor.log" >&2
exit 1
