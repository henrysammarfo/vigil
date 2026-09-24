export type DeskThread = {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
};

export type DeskMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  replyToId: string | null;
};

export type DeskQuota = {
  used: number;
  limit: number;
  remaining: number;
};

export type DeskContextChunk = {
  title: string;
  body: string;
  source: string;
  badge: string;
};

export type SlashCommand = {
  key: string;
  name: string;
  desc: string;
  prompt: string;
};

export const DESK_SLASH: SlashCommand[] = [
  {
    key: "growth",
    name: "/growth",
    desc: "$100→$5k paper book status",
    prompt: "Summarize my $100→$5000 growth book: equity, open/closed trades, and next closed-window move.",
  },
  {
    key: "allowlist",
    name: "/allowlist",
    desc: "FENN allowlist check",
    prompt: "What tickers are on my allowlist and how does FENN refuse-by-default apply right now?",
  },
  {
    key: "why",
    name: "/why",
    desc: "Latest why-cards",
    prompt: "Walk me through my latest why-cards and what gates refused or papered.",
  },
  {
    key: "agent",
    name: "/agent",
    desc: "When to Run agent",
    prompt: "When can I run the agent, and what should I check in Settings before the next closed-window cycle?",
  },
  {
    key: "quota",
    name: "/quota",
    desc: "Daily chat cap",
    prompt: "How many Desk chat messages do I have left today and how is the hard cap enforced?",
  },
];

export const DESK_FOLLOW_UPS = [
  "How is my $100→$5k growth book tracking?",
  "Which allowlist tickers should I prioritize after hours?",
  "Explain my last refused why-card in plain English",
];
