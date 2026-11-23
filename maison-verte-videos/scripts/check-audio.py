#!/usr/bin/env python3
"""
Verify that public/audio/ambient.wav is strictly non-musical / non-tonal:
- Exact duration (20.000 s), 48 kHz, stereo, 16-bit
- For each sound event in timeline/script1.json:
  1. Spectral flatness (geometric mean / arithmetic mean of active-band power spectrum) >= 0.15
  2. No isolated tonal frequency spike standing out sharply above local spectral median
Exits with code 1 on any failure.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
import numpy as np
from scipy.io import wavfile

EXPECTED_SR = 48000
MIN_FLATNESS = 0.15
MAX_PEAK_TO_MEDIAN_DB = 16.0


def analyze_segment(seg: np.ndarray, sr: int) -> tuple[float, float, float]:
    """
    Returns (mean_spectral_flatness, max_isolated_peak_db, peak_freq_hz).
    Computed over the active frequency band of the event (bins >= -24 dB of band max)
    using Welch-averaged short-time frames to reduce variance of random noise.
    """
    mono = seg.mean(axis=1) if seg.ndim == 2 else seg
    n = len(mono)
    nfft = min(1024, max(128, 1 << (n.bit_length() - 1)))
    hop = max(64, nfft // 2)

    if n < nfft:
        padded = np.zeros(nfft, dtype=np.float64)
        padded[:n] = mono * np.hanning(n)
        frames = [padded]
    else:
        win = np.hanning(nfft)
        frames = [
            mono[i : i + nfft] * win
            for i in range(0, n - nfft + 1, hop)
        ]

    # Average power spectrum across frames
    psd_accum = np.zeros(nfft // 2 + 1, dtype=np.float64)
    for fr in frames:
        spec = np.fft.rfft(fr)
        psd_accum += (spec.real**2 + spec.imag**2)
    psd = psd_accum / max(1, len(frames))
    freqs = np.fft.rfftfreq(nfft, d=1.0 / sr)

    # Ignore DC and sub-25 Hz
    valid = freqs >= 25.0
    psd_v = psd[valid]
    freqs_v = freqs[valid]

    max_p = float(np.max(psd_v)) + 1e-20
    # Active band: bins within 24 dB of the band peak (captures the passband of filtered noise)
    active = psd_v >= (max_p * 10.0 ** (-24.0 / 10.0))
    if np.sum(active) < 6:
        band = psd_v + 1e-20
    else:
        band = psd_v[active] + 1e-20

    geo_mean = float(np.exp(np.mean(np.log(band))))
    arith_mean = float(np.mean(band))
    flatness = geo_mean / max(arith_mean, 1e-20)

    # Check for isolated tonal spikes relative to local median (window of 11 bins)
    log_psd = 10.0 * np.log10(psd_v + 1e-20)
    half_k = 5
    max_prom_db = 0.0
    peak_freq = 0.0
    for i in range(len(log_psd)):
        lo = max(0, i - half_k)
        hi = min(len(log_psd), i + half_k + 1)
        neighbors = np.concatenate([log_psd[lo:i], log_psd[i + 1 : hi]])
        if len(neighbors) == 0:
            continue
        # Only check bins with meaningful energy (within 20 dB of peak)
        if log_psd[i] < (10.0 * np.log10(max_p) - 20.0):
            continue
        prom = float(log_psd[i] - np.median(neighbors))
        if prom > max_prom_db:
            max_prom_db = prom
            peak_freq = float(freqs_v[i])

    return flatness, max_prom_db, peak_freq


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    timeline_path = root / "timeline" / "script1.json"
    wav_path = root / "public" / "audio" / "ambient.wav"

    if not wav_path.exists():
        print(f"[FAIL] Audio file missing: {wav_path}")
        return 1

    with timeline_path.open("r", encoding="utf-8") as f:
        timeline = json.load(f)

    sr, data = wavfile.read(str(wav_path))
    expected_dur = float(timeline["duration"])
    expected_samples = int(round(expected_dur * EXPECTED_SR))

    failed = False
    print("=== La Maison Verte - Audio Non-Musicality & Spec Check ===")
    print(
        f"File: {wav_path.relative_to(root)} | SR={sr} Hz | "
        f"shape={data.shape} | dtype={data.dtype} | dur={len(data) / sr:.3f} s"
    )

    if sr != EXPECTED_SR:
        print(f"[FAIL] Sample rate is {sr}, expected {EXPECTED_SR}")
        failed = True
    if data.ndim != 2 or data.shape[1] != 2:
        print(f"[FAIL] Audio must be stereo, got shape {data.shape}")
        failed = True
    if data.dtype != np.int16:
        print(f"[FAIL] Audio must be 16-bit PCM, got {data.dtype}")
        failed = True
    if len(data) != expected_samples:
        print(f"[FAIL] Sample count is {len(data)}, expected {expected_samples}")
        failed = True

    audio = data.astype(np.float64) / 32768.0
    print("-" * 82)
    print(f"{'t (s)':>7} | {'dur':>5} | {'type':<14} | {'flatness':>8} | {'peak>med':>10} | {'status'}")
    print("-" * 82)

    for ev in timeline["sfx"]:
        ev_type = ev["type"]
        t0 = float(ev["t"])
        dur = float(ev["dur"])
        if ev_type == "silence_duck":
            print(f"{t0:7.2f} | {dur:5.2f} | {ev_type:<14} | {'n/a':>8} | {'n/a':>10} | SKIP (duck)")
            continue

        # For ultra-short transients, focus on the active burst window
        eff_dur = min(dur, 0.03) if ev_type in ("tick", "pop") else dur
        s = max(0, int(round(t0 * sr)))
        e = min(len(audio), int(round((t0 + eff_dur) * sr)))
        seg = audio[s:e]

        flatness, prom_db, peak_hz = analyze_segment(seg, sr)
        ok_flat = flatness >= MIN_FLATNESS
        ok_peak = prom_db <= MAX_PEAK_TO_MEDIAN_DB
        ok = ok_flat and ok_peak
        if not ok:
            failed = True
        status = "OK" if ok else f"FAIL ({'low flatness' if not ok_flat else ''} {'tonal spike @ ' + str(int(peak_hz)) + 'Hz' if not ok_peak else ''})"
        print(
            f"{t0:7.2f} | {dur:5.2f} | {ev_type:<14} | "
            f"{flatness:8.3f} | {prom_db:7.2f} dB | {status}"
        )

    print("-" * 82)
    if failed:
        print("[RESULT] FAILED — tonal artifact or spec mismatch detected.")
        return 1
    print("[RESULT] PASSED — all events verified as broadband non-musical noise/transients.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
