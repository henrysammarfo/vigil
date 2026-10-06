# QA Report — 2026-10-06T22:07:47.715Z

Base: https://vigil-one-wine.vercel.app
Result: **56/56 PASS** · fail=0

| Check | Status | Detail |
| --- | --- | --- |
| http/home | PASS | HTTP 200 |
| http/auth | PASS | HTTP 200 |
| http/how-it-works | PASS | HTTP 200 |
| http/journal | PASS | HTTP 200 |
| http/about | PASS | HTTP 200 |
| http/brand | PASS | HTTP 200 |
| http/contact | PASS | HTTP 200 |
| http/privacy | PASS | HTTP 200 |
| http/terms | PASS | HTTP 200 |
| gate/dashboard | PASS | 307 → auth |
| gate/dashboard/signals | PASS | 307 → auth |
| gate/dashboard/trades | PASS | 307 → auth |
| gate/dashboard/terminal | PASS | 307 → auth |
| gate/dashboard/journal | PASS | 307 → auth |
| gate/dashboard/replay | PASS | 307 → auth |
| gate/dashboard/settings | PASS | 307 → auth |
| gate/dashboard/chat | PASS | 307 → auth |
| hdr-hsts | PASS | max-age=63072000; includeSubDomains; preload |
| hdr-xfo | PASS | DENY |
| hdr-nosniff | PASS | nosniff |
| ui-desk/home | PASS | len=911 |
| ui-desk/auth | PASS | len=119 |
| ui-desk/how-it-works | PASS | len=815 |
| ui-desk/journal | PASS | len=501 |
| ui-desk/about | PASS | len=688 |
| ui-desk/brand | PASS | len=453 |
| ui-desk/contact | PASS | len=392 |
| ui-desk/privacy | PASS | len=2087 |
| ui-desk/terms | PASS | len=1833 |
| brand-download-desk | PASS | SVG download present |
| contact-submit-desk | PASS | clicked |
| ui-mob/home | PASS | len=854 |
| ui-mob/auth | PASS | len=119 |
| ui-mob/how-it-works | PASS | len=758 |
| ui-mob/journal | PASS | len=444 |
| ui-mob/about | PASS | len=631 |
| ui-mob/brand | PASS | len=396 |
| ui-mob/contact | PASS | len=335 |
| ui-mob/privacy | PASS | len=2030 |
| ui-mob/terms | PASS | len=1776 |
| brand-download-mob | PASS | SVG download present |
| contact-submit-mob | PASS | clicked |
| auth-register | PASS | vigil-qa-1791324393150@example.com |
| dash/overview | PASS | HTTP 200 |
| dash/signals | PASS | HTTP 200 |
| dash/trades | PASS | HTTP 200 |
| dash/terminal | PASS | HTTP 200 |
| dash/journal | PASS | HTTP 200 |
| dash/replay | PASS | HTTP 200 |
| dash/settings | PASS | HTTP 200 |
| dash/chat | PASS | HTTP 200 |
| run-agent | PASS | enabled |
| strategy-terminal | PASS | playbook UI |
| settings-controls | PASS | ok |
| desk-chat | PASS | composer present |
| mobile-dashboard | PASS | loads |
