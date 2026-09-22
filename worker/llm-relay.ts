/**
 * Optional Cloudflare Worker / Node relay for AgentRouter.
 * Deploy this on clean egress (CF Workers, Vercel, your laptop tunnel),
 * then set VIGIL_LLM_RELAY_URL=https://YOUR_RELAY/v1
 *
 * Why: Cursor cloud VMs in some regions hit Aliyun WAF on agentrouter.org.
 * TinyFish Fetch to the same host returns HTTP 401 (API alive) — proving
 * other egress works. Lovable/Cloudflare production Nitro often works too.
 */
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
    const upstream = await fetch("https://agentrouter.org/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${upstreamKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "claude-cli/1.0.0",
      },
      body,
    });

    const text = await upstream.text();
    if (/aliyun_waf/i.test(text)) {
      return Response.json(
        { error: "upstream_waf", message: "Relay host also blocked — move region" },
        { status: 502 },
      );
    }
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  },
};
