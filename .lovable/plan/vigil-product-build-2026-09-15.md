# VIGIL product build

## What I’ll build
- A merch-ready VIGIL identity: custom watch/market monogram, wordmark, lockups, and exportable SVG assets.
- A public site following the supplied Targo template: Quantico type, pale industrial canvas, cyan accent, staircase headlines, chamfered controls, and cinematic market visuals.
- Full public routes for Home, How it works, Journal, About, and Contact, each with complete content and metadata.
- A complete product dashboard with Overview, Signals, Paper trades, Why-log journal, Replay, and Settings views.
- Responsive desktop and mobile navigation, empty/loading-style states, filters, detail panels, replay controls, and paper-only disclosure labels.

## Product behavior
- Use realistic demo data clearly labeled as observed, estimated, or simulated.
- Model the core flow: closed-market check → event signal → rToken validation → policy decision → paper order → append-only why-card.
- Keep the dashboard interactive without implying live trading or financial advice.

## Technical details
- Preserve TanStack Start routing and create a real route file for every linked page.
- Use semantic design tokens in the global style system and Lucide’s premium-quality icon set already installed.
- Reuse the supplied background video where appropriate and add robust autoplay handling.
- Add unique metadata for every route and validate the finished experience at desktop and mobile sizes.
