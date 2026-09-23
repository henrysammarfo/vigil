/**
 * Optional Cloudflare Worker / Node relay for AgentRouter.
 * Deploy on clean egress, then set VIGIL_LLM_RELAY_URL=https://YOUR_RELAY/v1
 *
 * Prefer Tor in-process on cloud VMs: AGENTROUTER_USE_TOR=1 (scripts/tor-start.sh).
 * TinyFish Fetch does not forward Authorization — target 401 ≠ bad TinyFish key.
 */
const UPSTREAMS = [
  "https://agentrouter.org/v1/chat/completions",
  "https://co.agentrouter.org/v1/chat/completions",
];

function stainlessHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "QwenCode/0.2.0 (linux; x64)",
    "x-stainless-lang": "js",
    "x-stainless-package-version": "6.34.0",
    "x-stainless-os": "Linux",
    "x-stainless-arch": "x64",
    "x-stainless-runtime": "node",
    "x-stainless-runtime-version": "node/20.0.0",
    "x-stainless-retry-count": "0",
  };
}

function isWaf(text: string, contentType: string | null): boolean {
  if (contentType?.includes("text/html")) return true;
  return /aliyun_waf|aliyunCaptcha|unauthorized client detected/i.test(text);
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "vigil-llm-relay" });
    }
    if (request.method !== "POST" || !url.pathname.endsWith("/chat/completions")) {
      return new Response("Not found", { status: 404 });
    }

    const upstreamKey =
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      process.env.AGENTROUTER_API_KEY ||
      "";
    if (!upstreamKey) {
      return Response.json({ error: "missing upstream key" }, { status: 401 });
    }

    const body = await request.text();
    const headers = stainlessHeaders(upstreamKey);
    const errors: string[] = [];

    for (const upstreamUrl of UPSTREAMS) {
      try {
        const upstream = await fetch(upstreamUrl, {
          method: "POST",
          headers,
          body,
        });
        const text = await upstream.text();
        const ct = upstream.headers.get("content-type");
        if (isWaf(text, ct)) {
          errors.push(`${upstreamUrl}: WAF`);
          continue;
        }
        return new Response(text, {
          status: upstream.status,
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        errors.push(`${upstreamUrl}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return Response.json(
      {
        error: "upstream_unreachable",
        message: "All AgentRouter hosts failed (WAF or network)",
        errors,
      },
      { status: 502 },
    );
  },
};
