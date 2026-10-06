#!/usr/bin/env bun
/**
 * Mux raw Playwright webm + voiceover → final MP4 for Stampit.
 * Pads/trims video to voice length; soft fade; endcard title.
 *
 * Usage: bun scripts/compose-demo.ts
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";

const OUT = join(process.cwd(), "docs", "submission", "artifacts");
const RAW = join(OUT, "vigil-s2-demo-raw.webm");
const VO = existsSync(join(OUT, "vigil-s2-vo.mp3"))
  ? join(OUT, "vigil-s2-vo.mp3")
  : join(OUT, "vigil-s2-vo.wav");
const FINAL = join(OUT, "vigil-s2-demo.mp4");

async function main() {
  mkdirSync(OUT, { recursive: true });
  if (!existsSync(RAW)) throw new Error(`Missing ${RAW} — run bun scripts/record-demo.ts`);
  if (!existsSync(VO)) throw new Error(`Missing voiceover — run python scripts/demo-voiceover.py`);

  // Scale to 1920×1080; keep video/audio in sync; cut to shortest stream
  await $`ffmpeg -y -i ${RAW} -i ${VO} -filter_complex "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0a0a0a,setsar=1,fps=30,format=yuv420p[v];[1:a]afade=t=in:st=0:d=0.4[a]" -map "[v]" -map "[a]" -c:v libx264 -preset medium -crf 18 -c:a aac -b:a 192k -shortest -movflags +faststart ${FINAL}`;
  console.log("FINAL", FINAL);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
