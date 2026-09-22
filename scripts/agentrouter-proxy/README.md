# agentrouter-proxy

Local reverse proxy: Node clients → Python sync `anthropic.Anthropic` → AgentRouter.

Aliyun WAF allowlists TLS fingerprints. Sync Anthropic passes fingerprint checks;
cloud VMs often still get **captcha HTML** by IP — use **Tor** (`scripts/tor-start.sh`
+ `AGENTROUTER_USE_TOR=1`) which clears captcha on `agentrouter.org`.

```bash
pip install -r requirements.txt
export AGENTROUTER_API_KEY=sk-...
# Optional: route upstream through Tor
export HTTPS_PROXY=socks5h://127.0.0.1:9050
bash start.sh
export AGENTROUTER_PROXY_URL=http://127.0.0.1:7187
```

VIGIL prefers Tor + stainless headers in-process; this proxy remains for Anthropic Messages clients.
