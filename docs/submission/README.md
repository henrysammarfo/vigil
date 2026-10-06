# Submission artifacts index

| File | What |
| --- | --- |
| [`STAMPIT_PACK.md`](./STAMPIT_PACK.md) | Copy-paste Google Form answers |
| [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) | Story VO + sync beats |
| [`X_POST.md`](./X_POST.md) | Compliant X draft |
| [`QA_REPORT.md`](./QA_REPORT.md) | Live QA **56/56 PASS** (2026-10-06) |
| [`S2_SUBMISSION.md`](./S2_SUBMISSION.md) | Master form pack |
| [`artifacts/vigil-s2-demo.mp4`](./artifacts/vigil-s2-demo.mp4) | Final demo (1080p + VO) |

## Rebuild demo

```bash
bun run submit:qa
bun run demo:record
python scripts/demo-voiceover.py   # set ELEVENLABS_API_KEY for premium voice
bun run demo:compose
```

Voice default: Edge `en-US-AndrewMultilingualNeural` (clear presenter). Override with `VIGIL_DEMO_VOICE` or ElevenLabs.

## Henry checklist (human)

1. Paste `STAMPIT_PACK.md` into Google Form  
2. Upload / link `artifacts/vigil-s2-demo.mp4`  
3. Post `X_POST.md` (quote official Bitget_AI status)  
4. Confirm Demo Day = Yes · ATU · Agentic Trading / Event-Driven Agent  

Note: handbook deadline was **27 Sep 2026 UTC+8**; judge review window ran through **~07 Oct**. Submit ASAP if the form is still open.
