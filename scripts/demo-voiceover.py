#!/usr/bin/env python3
"""Generate demo voiceover with pauses matching DEMO_SCRIPT.md.

Prefers ElevenLabs if ELEVENLABS_API_KEY is set (voice: Sarah / student-clear).
Falls back to edge-tts en-US-AndrewMultilingualNeural.
"""
from __future__ import annotations

import asyncio
import os
import struct
import subprocess
import sys
import wave
from pathlib import Path

OUT_DIR = Path("docs/submission/artifacts")
OUT_DIR.mkdir(parents=True, exist_ok=True)
VO_WAV = OUT_DIR / "vigil-s2-vo.wav"
VO_MP3 = OUT_DIR / "vigil-s2-vo.mp3"

# Beats with trailing silence (seconds) for natural pacing
BEATS: list[tuple[str, float]] = [
    (
        "The US market sleeps. News does not. "
        "On Bitget, tokenized US stocks still move after hours and on weekends.",
        0.55,
    ),
    (
        "Most trading bots stay loud twenty-four seven. "
        "They chase headlines. They cannot explain a no. "
        "Traders either miss the move, or over-trade the noise.",
        0.65,
    ),
    (
        "VIGIL is different. "
        "It only wakes in the closed window. "
        "It checks the headline, the allowlist, and the real move. "
        "Nine times out of ten, it writes a no. That is the product.",
        0.7,
    ),
    (
        "Here is the desk. "
        "Overview shows the paper book — one hundred dollars, aiming for five thousand. "
        "Signals and the why-log keep every decision inspectable. "
        "The terminal runs the high win-rate playbooks on the allowlist — N V D A, A M D, Apple, and Tesla. "
        "Paper trades stay on Bitget Demo. No live capital.",
        0.6,
    ),
    (
        "Event to decision to paper execution — with the why attached. "
        "VIGIL. Closed-market intelligence for Bitget AI Base Camp. "
        "Paper only. Not financial advice.",
        0.8,
    ),
]


def silence_wav(seconds: float, rate: int = 24000) -> bytes:
    n = int(rate * seconds)
    return struct.pack("<" + "h" * n, *([0] * n))


async def synth_edge(text: str, path: Path) -> None:
    import edge_tts

    # Clear, natural “student presenter” male voice (multilingual neural)
    voice = os.environ.get("VIGIL_DEMO_VOICE", "en-US-AndrewMultilingualNeural")
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(str(path))


def synth_eleven(text: str, path: Path) -> bool:
    key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not key:
        return False
    try:
        import urllib.request
        import json

        # Sarah — clear young professional / student-friendly default
        voice_id = os.environ.get("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL")
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        body = json.dumps(
            {
                "text": text,
                "model_id": "eleven_multilingual_v2",
                "voice_settings": {
                    "stability": 0.45,
                    "similarity_boost": 0.8,
                    "style": 0.35,
                    "use_speaker_boost": True,
                },
            }
        ).encode()
        req = urllib.request.Request(
            url,
            data=body,
            headers={
                "xi-api-key": key,
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=120) as res:
            path.write_bytes(res.read())
        return True
    except Exception as e:
        print("elevenlabs_failed", e, file=sys.stderr)
        return False


def mp3_to_wav(mp3: Path, wav: Path) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(mp3),
            "-ar",
            "24000",
            "-ac",
            "1",
            str(wav),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def concat_wavs(parts: list[Path], out: Path) -> None:
    frames: list[bytes] = []
    params = None
    for p in parts:
        with wave.open(str(p), "rb") as w:
            if params is None:
                params = w.getparams()
            frames.append(w.readframes(w.getnframes()))
        # append silence after each beat using same rate
        assert params is not None
        # silence duration encoded in filename? we handle separately
    assert params is not None
    with wave.open(str(out), "wb") as w:
        w.setparams(params)
        for f in frames:
            w.writeframes(f)


async def main() -> None:
    tmp = OUT_DIR / "_vo_parts"
    tmp.mkdir(parents=True, exist_ok=True)
    part_wavs: list[Path] = []

    # Try full script via ElevenLabs once for consistency
    full = " ".join(t for t, _ in BEATS)
    eleven_mp3 = tmp / "full.mp3"
    if synth_eleven(full, eleven_mp3):
        print("voice=elevenlabs")
        mp3_to_wav(eleven_mp3, VO_WAV)
        subprocess.check_call(
            ["ffmpeg", "-y", "-i", str(VO_WAV), str(VO_MP3)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        print("wrote", VO_WAV, VO_MP3)
        return

    print("voice=edge-tts")
    try:
        import edge_tts  # noqa: F401
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", "edge-tts"])

    assembled = tmp / "assembled.wav"
    # Build beat-by-beat with pauses
    raw_parts: list[Path] = []
    for i, (text, pause) in enumerate(BEATS):
        mp3 = tmp / f"beat{i}.mp3"
        await synth_edge(text, mp3)
        wav = tmp / f"beat{i}.wav"
        mp3_to_wav(mp3, wav)
        raw_parts.append(wav)
        # write pause as separate wav
        with wave.open(str(wav), "rb") as w:
            rate = w.getframerate()
            channels = w.getnchannels()
            sampwidth = w.getsampwidth()
            data = w.readframes(w.getnframes())
        pause_path = tmp / f"pause{i}.wav"
        with wave.open(str(pause_path), "wb") as w:
            w.setnchannels(channels)
            w.setsampwidth(sampwidth)
            w.setframerate(rate)
            n = int(rate * pause)
            w.writeframes(b"\x00\x00" * n if sampwidth == 2 else b"\x00" * n * sampwidth)
        part_wavs.extend([wav, pause_path])

    # concat
    with wave.open(str(raw_parts[0]), "rb") as first:
        params = first.getparams()
    with wave.open(str(assembled), "wb") as out:
        out.setparams(params)
        for p in part_wavs:
            with wave.open(str(p), "rb") as w:
                out.writeframes(w.readframes(w.getnframes()))

    assembled.replace(VO_WAV) if False else None
    # copy assembled → VO_WAV
    VO_WAV.write_bytes(assembled.read_bytes())
    subprocess.check_call(
        ["ffmpeg", "-y", "-i", str(VO_WAV), "-codec:a", "libmp3lame", "-q:a", "2", str(VO_MP3)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    print("wrote", VO_WAV, VO_MP3)


if __name__ == "__main__":
    asyncio.run(main())
