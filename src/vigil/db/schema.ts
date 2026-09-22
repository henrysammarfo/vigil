import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const tenants = pgTable(
  "tenants",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tenants_slug_uidx").on(t.slug)],
);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_uidx").on(t.email)],
);

export const memberships = pgTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("memberships_tenant_user_uidx").on(t.tenantId, t.userId),
    index("memberships_user_idx").on(t.userId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_uidx").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
  ],
);

export const tenantSettings = pgTable("tenant_settings", {
  tenantId: text("tenant_id")
    .primaryKey()
    .references(() => tenants.id),
  weekendWatch: boolean("weekend_watch").notNull().default(true),
  afterHoursWatch: boolean("after_hours_watch").notNull().default(true),
  paperOnly: boolean("paper_only").notNull().default(true),
  maxPositionUsd: integer("max_position_usd").notNull().default(5000),
  minConfidence: integer("min_confidence").notNull().default(70),
  llmDeclared: text("llm_declared").notNull().default("undeclared"),
  /** FENN refuse-by-default. Empty allowlist means headline → NO. */
  fennMode: boolean("fenn_mode").notNull().default(true),
  allowlist: jsonb("allowlist").$type<string[]>().notNull().default([]),
  /** Fixed small paper size — never spray remaining balance. */
  fixedPaperSize: integer("fixed_paper_size").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiCredentialRefs = pgTable(
  "api_credential_refs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    provider: text("provider").notNull(),
    secretName: text("secret_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("cred_refs_tenant_provider_uidx").on(t.tenantId, t.provider)],
);

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    source: text("source").notNull(),
    headline: text("headline").notNull(),
    url: text("url"),
    tickerHint: text("ticker_hint"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    metricLabel: text("metric_label").notNull().default("observed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_tenant_observed_idx").on(t.tenantId, t.observedAt)],
);

export const signals = pgTable(
  "signals",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    ticker: text("ticker").notNull(),
    movePct: text("move_pct").notNull(),
    score: integer("score").notNull(),
    state: text("state").notNull(),
    metricLabel: text("metric_label").notNull().default("observed"),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("signals_tenant_created_idx").on(t.tenantId, t.createdAt)],
);

export const decisions = pgTable(
  "decisions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    signalId: text("signal_id")
      .notNull()
      .references(() => signals.id),
    action: text("action").notNull(),
    confidence: integer("confidence").notNull(),
    llmProvider: text("llm_provider").notNull(),
    llmModel: text("llm_model").notNull(),
    rationale: text("rationale").notNull(),
    metricLabel: text("metric_label").notNull().default("estimated"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("decisions_tenant_created_idx").on(t.tenantId, t.createdAt)],
);

export const paperOrders = pgTable(
  "paper_orders",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    decisionId: text("decision_id")
      .notNull()
      .references(() => decisions.id),
    symbol: text("symbol").notNull(),
    side: text("side").notNull(),
    quantity: text("quantity").notNull(),
    price: text("price"),
    status: text("status").notNull(),
    exchangeOrderId: text("exchange_order_id"),
    rawResponse: jsonb("raw_response").$type<Record<string, unknown>>().notNull().default({}),
    metricLabel: text("metric_label").notNull().default("observed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** open | closed — paper lifecycle (separate from exchange accept status) */
    lifecycle: text("lifecycle").notNull().default("open"),
    markPrice: text("mark_price"),
    unrealizedPnl: text("unrealized_pnl"),
    exitPrice: text("exit_price"),
    exitExchangeOrderId: text("exit_exchange_order_id"),
    realizedPnl: text("realized_pnl"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    entryAnalysis: jsonb("entry_analysis").$type<Record<string, unknown>>(),
  },
  (t) => [index("paper_orders_tenant_created_idx").on(t.tenantId, t.createdAt)],
);

export const whyCards = pgTable(
  "why_cards",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    decisionId: text("decision_id")
      .notNull()
      .references(() => decisions.id),
    seq: integer("seq").notNull(),
    prevHash: text("prev_hash").notNull(),
    contentHash: text("content_hash").notNull(),
    body: jsonb("body").$type<Record<string, unknown>>().notNull(),
    sealedAt: timestamp("sealed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("why_cards_tenant_seq_uidx").on(t.tenantId, t.seq),
    index("why_cards_tenant_sealed_idx").on(t.tenantId, t.sealedAt),
  ],
);

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    status: text("status").notNull(),
    windowState: text("window_state").notNull(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    summary: jsonb("summary").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index("agent_runs_tenant_started_idx").on(t.tenantId, t.startedAt)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").references(() => tenants.id),
    actorUserId: text("actor_user_id"),
    action: text("action").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_tenant_created_idx").on(t.tenantId, t.createdAt)],
);

export const contactMessages = pgTable("contact_messages", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
