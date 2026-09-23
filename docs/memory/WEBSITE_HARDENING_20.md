# Website hardening checklist (2026-09-23)

| # | Task | Status |
|---|------|--------|
| 1 | Privacy policy | `/privacy` |
| 2 | Terms & conditions | `/terms` |
| 3 | Remove frontend secrets | `docs/memory/FRONTEND_SECRETS.md` · only public `VITE_*` |
| 4 | Enforce HTTPS | HSTS + `upgrade-insecure-requests` in `vercel.json` |
| 5 | Cookie consent banner | `CookieConsentBanner` · optional analytics gated |
| 6 | Meta titles/descriptions | `pageMeta()` + root defaults |
| 7 | Social preview image | `/og-vigil.png` (compressed) |
| 8 | Favicon | `/favicon.ico` + SVG + apple-touch-icon |
| 9 | Sitemap and robots.txt | `/sitemap.xml` · `/robots.txt` |
| 10 | Image alt text | SVG `aria-label` · video `aria-label` · decorative `aria-hidden` |
| 11 | Image compression | OG PNG compressed via sharp · SVG mark |
| 12 | Page load speed | font preconnect · video `preload=metadata` · poster |
| 13 | Color contrast | darker `--muted-foreground` for AA-ish body text |
| 14 | Mobile responsiveness | existing header drawer · footer wrap · `100svh` |
| 15 | Custom 404 | branded NotFound + Create workspace CTA |
| 16 | Broken link fixes | footer legal · GitHub repo URL · noopener external |
| 17 | Form validation | contact client + Zod server min lengths |
| 18 | Spam protection | honeypot + rate limits + keyword filter |
| 19 | Analytics setup | Plausible after Accept (`VITE_PLAUSIBLE_DOMAIN`) |
| 20 | Single clear CTA | **Create workspace** (hero, header, ink section, 404) |
