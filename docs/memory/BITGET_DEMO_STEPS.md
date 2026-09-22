# Bitget Demo keys → competition paper log

Official: [Bitget Demo Trading REST](https://www.bitget.com/api-doc/classic/demotrading/restapi)

## 1. Create a Demo API Key (not a live key)

> **Critical:** The key must be created **after switching into Demo mode**.
> A key from the normal Account → API page is a **live** key. Using it with
> `paptrading: 1` returns `40099 exchange environment is incorrect`.

1. Log in at [bitget.com](https://www.bitget.com)
2. Switch to **Demo** mode (demo trading / paper) — confirm the ~virtual USDT demo balance
3. While still in Demo, open Personal Center → **API Key Management** → Create
4. On **Select API key type**, choose **System-generated API key** (HMAC)
   - Do **not** pick User-generated / RSA — VIGIL signs with HMAC-SHA256 (`createHmac`)
5. On **Create new API key**, set:
   - **Note:** `VIGIL S2 paper`
   - **Passphrase:** 8–32 alphanumeric (save this — it becomes `BITGET_PASSPHRASE`)
   - **Permissions:** **Read-write** (not Read-only)
   - **Permission type:** enable **Unified account → Manage** and **Trade** (orders/positions). Leave P2P and Withdraw off.
   - **Bind IP:** leave blank for now (optional later)
6. Copy **API Key**, **Secret**, **Passphrase** once (secret shown once)

KYC is required for Demo API per Bitget docs.

### If you see `40099 exchange environment is incorrect`

You created a **live** key (normal Account API page). Delete it for paper use, switch to **Demo**, create a new Demo key, then retry.

## 2. Put credentials in env (never commit)

```bash
# .env (gitignored)
BITGET_API_KEY=...
BITGET_API_SECRET=...
BITGET_PASSPHRASE=...
BITGET_PAPER=true
BITGET_BASE_URL=https://api.bitget.com
```

VIGIL refuses to trade unless `BITGET_PAPER=true` (`PAPER_LOCK_VIOLATION`).

## 3. How VIGIL calls Demo

`src/vigil/integrations/bitget-paper.ts` sends:

- HMAC-signed REST to `/api/v2/mix/order/place-order`
- Header `paptrading: 1` (required by Bitget Demo REST)

## 4. Run paper for the competition window

```bash
# Ensure closed-window + allowlist for the ticker you want to paper
# Settings UI: FENN on, allowlist e.g. NVDA, fixed size 1

DATABASE_URL=... SESSION_SECRET=... \
TINYFISH_API_KEY=... AGENTROUTER_USE_TOR=1 AGENTROUTER_API_KEY=... \
BITGET_PAPER=true BITGET_API_KEY=... BITGET_API_SECRET=... BITGET_PASSPHRASE=... \
bun run worker
```

Or trigger a single run from the dashboard **Run agent** action after login.

## 5. Export the paper log (submission artifact)

1. Open Dashboard → Paper trades / Journal
2. Use **Export** (server fn returns orders + why-cards)
3. Keep the JSON for the Google Form “submission materials” link
4. Cover the competition period (timestamps must span the event)

## 6. Checklist before submit

- [ ] Only Demo key used (`paptrading: 1`)
- [ ] `BITGET_PAPER=true` in prod secrets
- [ ] At least one sealed why-card per paper order
- [ ] Metrics labeled observed/estimated/targeted
- [ ] No invented fills / UIDs
