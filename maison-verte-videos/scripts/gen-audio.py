#!/usr/bin/env python3
"""
Synthesize deterministic non-musical, noise-and-transient-only audio track
for La Maison Verte - Script 1 (20.000 s, 48 kHz, 16-bit stereo WAV).
Reads timeline/script1.json as the single source of truth.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
BASE_SEED = 20260401


def db_to_lin(db: float) -> float:
    return 10.0 ** (db / 20.0)


def pink_noise(n: int, rng: np.random.Generator) -> np.ndarray:
    """Generate approximate pink noise via Paul Kellet's filter on white noise."""
    white = rng.standard_normal(n)
    b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0
    out = np.empty(n, dtype=np.float64)
    # Vectorized IIR pinking filter approximation (3 cascaded 1st-order shelves)
    # Using scipy lfilter for speed and determinism
    # Paul Kellet parallel poles equivalent via FFT 1/sqrt(f) shaping (strictly broadband noise)
    freqs = np.fft.rfftfreq(n, d=1.0 / SR)
    spec = np.fft.rfft(white)
    shaping = np.ones_like(freqs)
    mask = freqs > 20.0
    shaping[mask] = 1.0 / np.sqrt(freqs[mask] / 100.0)
    shaping[freqs < 45.0] *= (freqs[freqs < 45.0] / 45.0) ** 2
    shaping[freqs > 8000.0] *= np.exp(-((freqs[freqs > 8000.0] - 8000.0) / 4000.0) ** 2)
    spec *= shaping
    out = np.fft.irfft(spec, n=n)
    rms = np.sqrt(np.mean(out**2)) + 1e-12
    return out / rms


def butter_filter(
    x: np.ndarray,
    btype: str,
    cutoff: float | tuple[float, float],
    order: int = 2,
) -> np.ndarray:
    nyq = SR * 0.5
    if isinstance(cutoff, tuple):
        lo = max(20.0, min(cutoff[0], nyq - 200.0))
        hi = max(lo + 40.0, min(cutoff[1], nyq - 100.0))
        wn = [lo / nyq, hi / nyq]
    else:
        wn = max(20.0, min(cutoff, nyq - 100.0)) / nyq
    sos = signal.butter(order, wn, btype=btype, output="sos")
    return signal.sosfilt(sos, x)


def sweep_filter_noise(
    n: int,
    rng: np.random.Generator,
    mode: str,
    f_start: float,
    f_end: float,
    bandwidth_ratio: float = 0.9,
) -> np.ndarray:
    """
    Time-varying Butterworth filter sweep on white noise using overlap-add
    of Hann-windowed blocks so the spectrum stays broadband and smooth.
    """
    raw = rng.standard_normal(n)
    num_steps = max(8, min(32, int(n / (SR * 0.035))))
    edges = np.linspace(0, n, num_steps + 1, dtype=int)
    out = np.zeros(n, dtype=np.float64)
    weight = np.zeros(n, dtype=np.float64)

    for i in range(num_steps):
        center = (edges[i] + edges[i + 1]) // 2
        half_w = max(256, int((edges[i + 1] - edges[i]) * 1.25))
        s = max(0, center - half_w)
        e = min(n, center + half_w)
        if e - s < 32:
            continue

        frac = i / max(1, num_steps - 1)
        fc = f_start * ((f_end / max(1.0, f_start)) ** frac)
        seg = raw[s:e]

        if mode == "bandpass":
            lo = max(40.0, fc * (1.0 - bandwidth_ratio * 0.45))
            hi = min(SR * 0.46, fc * (1.0 + bandwidth_ratio * 0.65))
            filtered = butter_filter(seg, "bandpass", (lo, hi), order=2)
        elif mode == "lowpass":
            filtered = butter_filter(seg, "lowpass", fc, order=2)
        elif mode == "highpass":
            filtered = butter_filter(seg, "highpass", fc, order=2)
        else:
            filtered = seg

        win = np.hanning(e - s)
        out[s:e] += filtered * win
        weight[s:e] += win

    out /= np.maximum(weight, 1e-6)
    rms = np.sqrt(np.mean(out**2)) + 1e-12
    return out / rms


def synth_event(ev: dict, rng: np.random.Generator) -> np.ndarray:
    ev_type = ev["type"]
    dur = float(ev["dur"])
    n = max(1, int(round(dur * SR)))
    t = np.linspace(0.0, dur, n, endpoint=False)
    gain = db_to_lin(float(ev.get("gainDb", -14.0)))

    if ev_type == "bed":
        y = pink_noise(n, rng)
        fade_in = min(n, int(0.08 * SR))
        fade_out = min(n, int(0.30 * SR))
        y[:fade_in] *= np.linspace(0.0, 1.0, fade_in)
        y[-fade_out:] *= np.linspace(1.0, 0.0, fade_out)
        return y * gain

    if ev_type == "whoosh":
        f_from = float(ev.get("from", 400.0))
        f_to = float(ev.get("to", 3000.0))
        y = sweep_filter_noise(n, rng, "bandpass", f_from, f_to, bandwidth_ratio=1.1)
        env = np.sin(np.pi * np.linspace(0.0, 1.0, n)) ** 1.4
        return y * env * gain

    if ev_type == "tick":
        # 8 ms filtered noise transient inside event window
        y = np.zeros(n, dtype=np.float64)
        burst_n = min(n, int(round(0.008 * SR)))
        burst = rng.standard_normal(burst_n)
        burst = butter_filter(burst, "highpass", 1800.0, order=2)
        env = np.exp(-np.linspace(0.0, 5.5, burst_n))
        burst *= env
        burst /= np.max(np.abs(burst)) + 1e-12
        y[:burst_n] = burst
        return y * gain

    if ev_type == "pop":
        # 20 ms broadband band-pass noise burst centered around 1.5 kHz
        y = np.zeros(n, dtype=np.float64)
        burst_n = min(n, int(round(0.020 * SR)))
        burst = rng.standard_normal(burst_n)
        burst = butter_filter(burst, "bandpass", (700.0, 2600.0), order=2)
        att = max(1, int(0.002 * SR))
        env = np.exp(-np.linspace(0.0, 4.8, burst_n))
        env[:att] *= np.linspace(0.0, 1.0, att)
        burst *= env
        burst /= np.max(np.abs(burst)) + 1e-12
        y[:burst_n] = burst
        return y * db_to_lin(float(ev.get("gainDb", -12.0)))

    if ev_type == "thump_noise":
        # Low-pass noise (< 150 Hz) with short exponential envelope
        raw = rng.standard_normal(n)
        y = butter_filter(raw, "lowpass", 150.0, order=1)
        att = max(1, int(0.004 * SR))
        env = np.exp(-t / 0.065)
        env[:att] *= np.linspace(0.0, 1.0, att)
        y *= env
        y /= np.max(np.abs(y)) + 1e-12
        return y * db_to_lin(float(ev.get("gainDb", -10.0)))

    if ev_type == "hiss_decay":
        raw = rng.standard_normal(n)
        y = butter_filter(raw, "highpass", 2400.0, order=2)
        att = max(1, int(0.015 * SR))
        env = np.exp(-t / (dur * 0.28))
        env[:att] *= np.linspace(0.0, 1.0, att)
        y *= env
        y /= np.sqrt(np.mean(y**2)) + 1e-12
        return y * gain

    if ev_type == "hiss_shimmer":
        raw = rng.standard_normal(n)
        y = butter_filter(raw, "highpass", 2800.0, order=2)
        mod_hz = float(ev.get("modHz", 0.6))
        # Pure slow amplitude modulation of broadband noise (non-tonal)
        mod = 0.62 + 0.38 * np.sin(2.0 * math.pi * mod_hz * t)
        fade = min(n // 4, int(0.15 * SR))
        env = np.ones(n, dtype=np.float64)
        env[:fade] = np.linspace(0.0, 1.0, fade)
        env[-fade:] = np.linspace(1.0, 0.0, fade)
        y *= mod * env
        y /= np.sqrt(np.mean(y**2)) + 1e-12
        return y * gain

    if ev_type == "rumble_rise":
        cut_from = float(ev.get("cutFrom", 120.0))
        cut_to = float(ev.get("cutTo", 400.0))
        y = sweep_filter_noise(n, rng, "lowpass", cut_from, cut_to)
        fade = min(n // 4, int(0.18 * SR))
        env = np.linspace(0.55, 1.0, n)
        env[:fade] *= np.linspace(0.0, 1.0, fade)
        env[-fade:] *= np.linspace(1.0, 0.0, fade)
        y *= env
        y /= np.sqrt(np.mean(y**2)) + 1e-12
        return y * gain

    if ev_type == "riser_noise":
        cut_from = float(ev.get("cutFrom", 500.0))
        cut_to = float(ev.get("cutTo", 6000.0))
        y = sweep_filter_noise(n, rng, "highpass", cut_from, cut_to)
        env = (np.linspace(0.0, 1.0, n) ** 1.7)
        fade_out = min(n // 8, int(0.03 * SR))
        env[-fade_out:] *= np.linspace(1.0, 0.0, fade_out)
        y *= env
        y /= np.sqrt(np.mean(y**2)) + 1e-12
        return y * db_to_lin(float(ev.get("gainDb", -15.0)))

    if ev_type == "swish":
        raw = rng.standard_normal(n)
        y = butter_filter(raw, "highpass", 1300.0, order=2)
        peak_idx = max(1, int(0.22 * n))
        env = np.empty(n, dtype=np.float64)
        env[:peak_idx] = np.linspace(0.0, 1.0, peak_idx) ** 1.3
        env[peak_idx:] = np.linspace(1.0, 0.0, n - peak_idx) ** 2.2
        y *= env
        y /= np.sqrt(np.mean(y**2)) + 1e-12
        return y * db_to_lin(float(ev.get("gainDb", -14.0)))

    return np.zeros(n, dtype=np.float64)


def make_reverb_ir(rng: np.random.Generator, dur: float = 0.30) -> np.ndarray:
    """Synthetic stereo impulse response: exponentially decaying filtered noise."""
    n = int(round(dur * SR))
    t = np.linspace(0.0, dur, n, endpoint=False)
    decay = np.exp(-t / 0.075)
    ir = np.zeros((n, 2), dtype=np.float64)
    for ch in range(2):
        noise = rng.standard_normal(n)
        noise = butter_filter(noise, "bandpass", (200.0, 6500.0), order=2)
        ir[:, ch] = noise * decay
        ir[:, ch] /= np.sqrt(np.sum(ir[:, ch] ** 2)) + 1e-12
    return ir


def measure_lufs(stereo: np.ndarray) -> float:
    """Approximate integrated LUFS using ITU-R BS.1770-4 K-weighting pre-filters."""
    # High-shelf (+4 dB above ~1.5 kHz) + High-pass (~38 Hz)
    b_hp, a_hp = signal.butter(2, 38.0 / (SR * 0.5), btype="highpass")
    # Pre-filter shelf approximation at 48 kHz (standard BS.1770-4 coefficients)
    b_sh = np.array([1.53512485958697, -2.69169618940638, 1.19839281085285])
    a_sh = np.array([1.0, -1.69065929318241, 0.73248077421585])

    total_power = 0.0
    for ch in range(2):
        y = signal.lfilter(b_sh, a_sh, stereo[:, ch])
        y = signal.lfilter(b_hp, a_hp, y)
        total_power += float(np.mean(y**2))
    return -0.691 + 10.0 * math.log10(max(total_power, 1e-12))


def soft_limit(stereo: np.ndarray, ceiling_db: float = -1.5) -> np.ndarray:
    ceiling = db_to_lin(ceiling_db)
    peak = float(np.max(np.abs(stereo)))
    if peak <= ceiling:
        return stereo
    # Transparent soft-knee limiter capped strictly at ceiling
    knee = ceiling * 0.85
    out = np.copy(stereo)
    abs_x = np.abs(out)
    over = abs_x > knee
    excess = (abs_x[over] - knee) / max(1e-6, ceiling - knee)
    compressed = knee + (ceiling - knee) * np.tanh(excess)
    out[over] = np.sign(out[over]) * compressed
    return np.clip(out, -ceiling, ceiling)


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    timeline_path = root / "timeline" / "script1.json"
    out_path = root / "public" / "audio" / "ambient.wav"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with timeline_path.open("r", encoding="utf-8") as f:
        timeline = json.load(f)

    total_dur = float(timeline["duration"])
    total_samples = int(round(total_dur * SR))

    rng = np.random.default_rng(BASE_SEED)
    bed_mix = np.zeros((total_samples, 2), dtype=np.float64)
    sfx_mix = np.zeros((total_samples, 2), dtype=np.float64)

    # First pass: generate bed and non-duck events
    duck_events: list[dict] = []
    for idx, ev in enumerate(timeline["sfx"]):
        ev_type = ev["type"]
        if ev_type == "silence_duck":
            duck_events.append(ev)
            continue

        ev_rng = np.random.default_rng(BASE_SEED + (idx + 1) * 997)
        mono = synth_event(ev, ev_rng)
        start = int(round(float(ev["t"]) * SR))
        end = min(total_samples, start + len(mono))
        seg_len = end - start
        if seg_len <= 0:
            continue

        if ev_type == "bed":
            # Decorrelated stereo bed
            mono_r = synth_event(ev, np.random.default_rng(BASE_SEED + 77777))
            bed_mix[start:end, 0] += mono[:seg_len]
            bed_mix[start:end, 1] += mono_r[:seg_len]
        else:
            # Slight deterministic stereo pan in [-0.28, +0.28]
            pan = float(ev_rng.uniform(-0.28, 0.28))
            angle = (pan + 1.0) * math.pi * 0.25
            gl = math.cos(angle)
            gr = math.sin(angle)
            sfx_mix[start:end, 0] += mono[:seg_len] * gl
            sfx_mix[start:end, 1] += mono[:seg_len] * gr

    # Apply silence_duck to bed (-15 dB over dur with smooth 10 ms ramps)
    for ev in duck_events:
        start = int(round(float(ev["t"]) * SR))
        dur_n = int(round(float(ev["dur"]) * SR))
        end = min(total_samples, start + dur_n)
        seg_len = end - start
        if seg_len <= 0:
            continue
        duck_gain = db_to_lin(-15.0)
        ramp = min(seg_len // 3, int(0.010 * SR))
        env = np.full(seg_len, duck_gain, dtype=np.float64)
        if ramp > 0:
            env[:ramp] = np.linspace(1.0, duck_gain, ramp)
            env[-ramp:] = np.linspace(duck_gain, 1.0, ramp)
        bed_mix[start:end, 0] *= env
        bed_mix[start:end, 1] *= env

    # Short synthetic convolution reverb (0.3 s decaying noise IR) on SFX bus
    ir = make_reverb_ir(rng, dur=0.30)
    wet = np.zeros_like(sfx_mix)
    for ch in range(2):
        conv = signal.fftconvolve(sfx_mix[:, ch], ir[:, ch], mode="full")[:total_samples]
        wet[:, ch] = conv

    mix = bed_mix + sfx_mix + 0.14 * wet

    # Also keep the silence_duck window clean (subtle attenuation of reverb tail)
    for ev in duck_events:
        start = int(round(float(ev["t"]) * SR))
        dur_n = int(round(float(ev["dur"]) * SR))
        end = min(total_samples, start + dur_n)
        seg_len = end - start
        if seg_len > 0:
            ramp = min(seg_len // 3, int(0.008 * SR))
            env = np.full(seg_len, db_to_lin(-15.0), dtype=np.float64)
            if ramp > 0:
                env[:ramp] = np.linspace(1.0, db_to_lin(-15.0), ramp)
                env[-ramp:] = np.linspace(db_to_lin(-15.0), 1.0, ramp)
            mix[start:end, 0] *= env
            mix[start:end, 1] *= env

    # Ensure clean loop boundary (fade out last 0.04s to zero)
    tail_fade = int(0.04 * SR)
    mix[-tail_fade:, 0] *= np.linspace(1.0, 0.0, tail_fade)
    mix[-tail_fade:, 1] *= np.linspace(1.0, 0.0, tail_fade)

    # Normalize to ~ -16 LUFS and limit to -1.5 dBTP
    current_lufs = measure_lufs(mix)
    gain_needed = db_to_lin(-16.0 - current_lufs)
    mix *= gain_needed
    mix = soft_limit(mix, ceiling_db=-1.5)
    final_lufs = measure_lufs(mix)
    peak_db = 20.0 * math.log10(max(float(np.max(np.abs(mix))), 1e-12))

    pcm = np.round(mix * 32767.0).astype(np.int16)
    wavfile.write(str(out_path), SR, pcm)

    print(
        f"[gen-audio] Wrote {out_path.relative_to(root)} | "
        f"{total_samples} samples ({total_samples / SR:.3f} s) | "
        f"{SR} Hz 16-bit stereo | {final_lufs:.2f} LUFS | peak {peak_db:.2f} dBFS"
    )


if __name__ == "__main__":
    main()
