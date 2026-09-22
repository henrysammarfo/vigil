import { sql } from "drizzle-orm";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type VigilDb = ReturnType<typeof drizzlePg<typeof schema>>;

let dbSingleton: VigilDb | null = null;
let migratePromise: Promise<void> | null = null;

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is required (Cloud SQL Postgres in production)");
  }
  return url;
}

export async function getDb(): Promise<VigilDb> {
  if (dbSingleton) return dbSingleton;

  const url = requireDatabaseUrl();

  if (url.startsWith("pglite:")) {
    const rest = url.slice("pglite:".length);
    const dataDir = !rest || rest.startsWith("memory") ? undefined : rest;
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
    const client = new PGlite(dataDir);
    dbSingleton = drizzlePglite(client, { schema }) as unknown as VigilDb;
    await ensureSchema(dbSingleton);
    return dbSingleton;
  }

  const client = postgres(url, { max: 10, prepare: false });
  dbSingleton = drizzlePg(client, { schema });
  await ensureSchema(dbSingleton);
  return dbSingleton;
}

const DDL = `
CREATE TABLE IF NOT EXISTS tenants (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS memberships (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  user_id text NOT NULL REFERENCES users(id),
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);
CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  tenant_id text NOT NULL REFERENCES tenants(id),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id text PRIMARY KEY REFERENCES tenants(id),
  weekend_watch boolean NOT NULL DEFAULT true,
  after_hours_watch boolean NOT NULL DEFAULT true,
  paper_only boolean NOT NULL DEFAULT true,
  max_position_usd integer NOT NULL DEFAULT 5000,
  min_confidence integer NOT NULL DEFAULT 70,
  llm_declared text NOT NULL DEFAULT 'undeclared',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS api_credential_refs (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  provider text NOT NULL,
  secret_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, provider)
);
CREATE TABLE IF NOT EXISTS events (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  source text NOT NULL,
  headline text NOT NULL,
  url text,
  ticker_hint text,
  observed_at timestamptz NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  metric_label text NOT NULL DEFAULT 'observed',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS signals (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  event_id text NOT NULL REFERENCES events(id),
  ticker text NOT NULL,
  move_pct text NOT NULL,
  score integer NOT NULL,
  state text NOT NULL,
  metric_label text NOT NULL DEFAULT 'observed',
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS decisions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  signal_id text NOT NULL REFERENCES signals(id),
  action text NOT NULL,
  confidence integer NOT NULL,
  llm_provider text NOT NULL,
  llm_model text NOT NULL,
  rationale text NOT NULL,
  metric_label text NOT NULL DEFAULT 'estimated',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS paper_orders (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  decision_id text NOT NULL REFERENCES decisions(id),
  symbol text NOT NULL,
  side text NOT NULL,
  quantity text NOT NULL,
  price text,
  status text NOT NULL,
  exchange_order_id text,
  raw_response jsonb NOT NULL DEFAULT '{}',
  metric_label text NOT NULL DEFAULT 'observed',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS why_cards (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  decision_id text NOT NULL REFERENCES decisions(id),
  seq integer NOT NULL,
  prev_hash text NOT NULL,
  content_hash text NOT NULL,
  body jsonb NOT NULL,
  sealed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, seq)
);
CREATE TABLE IF NOT EXISTS agent_runs (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  status text NOT NULL,
  window_state text NOT NULL,
  error_code text,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  summary jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS audit_log (
  id text PRIMARY KEY,
  tenant_id text REFERENCES tenants(id),
  actor_user_id text,
  action text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS contact_messages (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;

async function ensureSchema(db: VigilDb): Promise<void> {
  if (migratePromise) return migratePromise;
  migratePromise = (async () => {
    for (const stmt of DDL.split(";")
      .map((s) => s.trim())
      .filter(Boolean)) {
      await db.execute(sql.raw(stmt));
    }
  })();
  return migratePromise;
}

export async function resetDbForTests(): Promise<void> {
  dbSingleton = null;
  migratePromise = null;
}
