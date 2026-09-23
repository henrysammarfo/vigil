/** Canonical public site URL for SEO, OG, sitemap. */
export function siteUrl(): string {
  const fromEnv =
    (typeof process !== "undefined" && process.env["VITE_SITE_URL"]?.trim()) ||
    (typeof process !== "undefined" && process.env["SITE_URL"]?.trim()) ||
    "";
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "https://vigil-one-wine.vercel.app";
}

export const SITE_NAME = "VIGIL";
export const SITE_TAGLINE = "The market sleeps. We don't.";
export const DEFAULT_DESCRIPTION =
  "Closed-market intelligence that turns after-hours news into explainable Bitget Demo paper trades. Paper only · not financial advice.";

export function pageMeta(input: {
  title: string;
  description: string;
  path?: string;
  noIndex?: boolean;
}) {
  const url = `${siteUrl()}${input.path ?? ""}`;
  const ogImage = `${siteUrl()}/og-vigil.png`;
  const meta: Array<Record<string, string>> = [
    { title: input.title },
    { name: "description", content: input.description },
    { property: "og:title", content: input.title },
    { property: "og:description", content: input.description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: url },
    { property: "og:image", content: ogImage },
    { property: "og:site_name", content: SITE_NAME },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:site", content: "@henrysammarfo" },
    { name: "twitter:title", content: input.title },
    { name: "twitter:description", content: input.description },
    { name: "twitter:image", content: ogImage },
  ];
  if (input.noIndex) {
    meta.push({ name: "robots", content: "noindex, nofollow" });
  }
  return meta;
}
