# Frontend secret hygiene
#
# Allowed in the browser bundle (VITE_* only):
# - VITE_SITE_URL — public canonical URL
# - VITE_PLAUSIBLE_DOMAIN — public analytics hostname
# - VITE_CLERK_PUBLISHABLE_KEY — Clerk publishable key (not the secret)
#
# Never put in VITE_* or client code:
# - SESSION_SECRET, DATABASE_URL
# - BITGET_API_KEY / SECRET / PASSPHRASE
# - AGENTROUTER_API_KEY, VENICE_API_KEY, TINYFISH_API_KEY, TAVILY_API_KEY
# - CLERK_SECRET_KEY, any Bearer tokens
#
# Bitget Demo keys belong in per-tenant encrypted Settings (server), not the frontend.
