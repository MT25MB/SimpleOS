#!/usr/bin/env python3
"""Offline speech-to-text for SimpleOS push-to-talk.

Reads one 16 kHz mono WAV file and prints JSON with a transcript. The Vosk
model is local; this script makes no network requests. Any failure returns an
empty transcript so the caller can show a plain-English message.
"""
import json
import os
import sys
import wave

MODEL_PATH = os.environ.get("SIMPLEOS_VOSK_MODEL", "/usr/share/simpleos/vosk-model")


def main() -> None:
    if len(sys.argv) != 2:
        print(json.dumps({"text": ""}))
        return
    try:
        with wave.open(sys.argv[1], "rb") as wav:
            if wav.getnchannels() != 1 or wav.getframerate() != 16000:
                print(json.dumps({"text": ""}))
                return
            from vosk import KaldiRecognizer, Model

            recognizer = KaldiRecognizer(Model(MODEL_PATH), 16000)
            parts = []
            while True:
                data = wav.readframes(4000)
                if not data:
                    break
                if recognizer.AcceptWaveform(data):
                    parts.append(json.loads(recognizer.Result()).get("text", ""))
            parts.append(json.loads(recognizer.FinalResult()).get("text", ""))
            print(json.dumps({"text": " ".join(p for p in parts if p).strip()}))
    except Exception:
        print(json.dumps({"text": ""}))


if __name__ == "__main__":
    main()
