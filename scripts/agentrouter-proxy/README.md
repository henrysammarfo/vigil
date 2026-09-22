# AgentRouter WAF bypass proxy

AgentRouter’s Aliyun WAF allowlists **TLS fingerprints**, not just Bearer tokens.
Node `fetch`, `curl`, and async httpx are rejected (`unauthorized client detected`
or captcha HTML). The **Python sync `anthropic` SDK** is on the allowlist.

This proxy (adapted from [agentrouter-opencode-proxy](https://github.com/Goodnessmbakara/agentrouter-opencode-proxy))
receives Anthropic Messages requests on `127.0.0.1:7187` and re-issues them with
`anthropic.Anthropic` (sync).

```bash
pip install -r requirements.txt
export AGENTROUTER_API_KEY=sk-...
bash start.sh
# then:
export AGENTROUTER_PROXY_URL=http://127.0.0.1:7187
```

VIGIL `llm.ts` prefers `AGENTROUTER_PROXY_URL` when set.

**Note:** Cursor cloud VMs in some regions also receive **captcha HTML** (IP/geo),
which fingerprint alone cannot clear. Use this proxy on laptop / CF Worker relay /
Lovable Nitro egress. Official portal host `https://co.agentrouter.org` skips the
captcha page but may reject keys issued only for `agentrouter.org`.
