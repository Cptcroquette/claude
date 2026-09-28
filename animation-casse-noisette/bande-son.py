"""Bande-son du teaser Le Casse-Noisette (15 s), entièrement synthétisée.

Valse de boîte à musique en mi mineur (composition originale), vent, grelots
lointains, porte qui grince, souffle, lampes qui grésillent, coeur qui bat,
mâchoire en bois, CRAC, choeur et cloches sur le sapin.
Les repères de temps sont ceux de animation.js.

    python3 bande-son.py   ->  export/bande-son.wav   (48 kHz, stéréo)
"""
import os
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
DUR = 15.0
N = int(SR * DUR)
rng = np.random.default_rng(7)

DRY = np.zeros((2, N))
SEND = np.zeros((2, N))  # départ réverbération


def tt(d):
    return np.arange(int(d * SR)) / SR


def mf(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def P(t, a, b):
    return np.clip((t - a) / (b - a), 0, 1)


def add(sig, t0, gain=1.0, pan=0.0, rev=0.3):
    """Place un son mono à t0 (s), avec panoramique [-1, 1] et départ réverb."""
    i0 = int(round(t0 * SR))
    if i0 < 0:
        sig, i0 = sig[-i0:], 0
    n = min(len(sig), N - i0)
    if n <= 0:
        return
    s = sig[:n] * gain
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    DRY[0, i0:i0 + n] += s * gl
    DRY[1, i0:i0 + n] += s * gr
    SEND[0, i0:i0 + n] += s * gl * rev
    SEND[1, i0:i0 + n] += s * gr * rev


def bandpass(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def lowpass(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="low", fs=SR, output="sos"), x)


def highpass(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="high", fs=SR, output="sos"), x)


def resonate(x, freqs, q=18, gains=None):
    out = np.zeros_like(x)
    for i, f in enumerate(freqs):
        b, a = signal.iirpeak(f, q, fs=SR)
        out += signal.lfilter(b, a, x) * (gains[i] if gains else 1)
    return out


def sweep_bp(x, f0, f1, q=2.0, curve=None):
    """Passe-bande dont la fréquence glisse de f0 à f1 (traitement par blocs)."""
    out = np.zeros_like(x)
    blk = 512
    zi = None
    nb = (len(x) + blk - 1) // blk
    for i in range(nb):
        k = i / max(1, nb - 1)
        if curve is not None:
            k = curve(k)
        f = f0 * (f1 / f0) ** k
        sos = signal.butter(1, [f / (1 + .5 / q), min(f * (1 + .5 / q), SR / 2 - 100)], btype="band", fs=SR, output="sos")
        if zi is None:
            zi = signal.sosfilt_zi(sos) * 0
        out[i * blk:(i + 1) * blk], zi = signal.sosfilt(sos, x[i * blk:(i + 1) * blk], zi=zi)
    return out


# ---------------------------------------------------------------------------
# INSTRUMENTS
# ---------------------------------------------------------------------------
def music_box(freq, dur=2.6):
    t = tt(dur)
    s = np.sin(2 * np.pi * freq * t) * np.exp(-t * 2.0)
    s += .30 * np.sin(2 * np.pi * freq * 2.0 * t) * np.exp(-t * 4.0)
    s += .16 * np.sin(2 * np.pi * freq * 5.4 * t + 1.0) * np.exp(-t * 10)   # partiel de lame
    s += .07 * np.sin(2 * np.pi * freq * 8.93 * t + 2.0) * np.exp(-t * 18)
    click = rng.standard_normal(len(t)) * np.exp(-t * 900) * .15
    return (s + highpass(click, 3000)) * np.minimum(1, t / .0015)


def bell(freq, dur=4.0):
    t = tt(dur)
    s = np.zeros_like(t)
    for r, a, d in [(.5, .5, .6), (1, 1, .9), (1.19, .45, 1.4), (1.56, .35, 1.8), (2.0, .4, 2.4), (2.66, .25, 3.5), (3.0, .2, 4.0), (4.1, .12, 6)]:
        s += a * np.sin(2 * np.pi * freq * r * t) * np.exp(-t * d)
    return s * np.minimum(1, t / .002)


def pizz(freq, dur=1.2):
    t = tt(dur)
    s = np.sin(2 * np.pi * freq * t) + .5 * np.sin(4 * np.pi * freq * t) + .25 * np.sin(6 * np.pi * freq * t)
    return lowpass(s * np.exp(-t * 5) * np.minimum(1, t / .004), 1200)


def choir(midis, dur, amp=1.0, lp=1400):
    """Choeur "ooh" : dents de scie désaccordées, vibrato, filtrées."""
    t = tt(dur)
    out = np.zeros_like(t)
    for m in midis:
        f = mf(m)
        for det in (-.08, 0, .07):
            vib = 1 + .004 * np.sin(2 * np.pi * (5 + rng.random()) * t + rng.random() * 6)
            ph = 2 * np.pi * np.cumsum(f * 2 ** (det / 12) * vib) / SR
            for n in range(1, 11):
                out += np.sin(n * ph) / n
    out = lowpass(out, lp, 4)
    out += .6 * bandpass(out, 300, 500)  # formant "ou"
    return out / np.max(np.abs(out)) * amp


def boom(f0=70, f1=32, dur=1.8):
    t = tt(dur)
    f = f1 + (f0 - f1) * np.exp(-t * 4)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    s += lowpass(rng.standard_normal(len(t)), 300) * np.exp(-t * 18) * .8
    return np.tanh(s * 1.6)


def creak(dur, rate0, rate1, res, q=14, seed=0, jitter=.35):
    """Grincement : train d'impulsions irrégulier dans des résonateurs."""
    r = np.random.default_rng(seed)
    x = np.zeros(int(dur * SR))
    t = 0.0
    while t < dur:
        k = t / dur
        rate = (rate0 + (rate1 - rate0) * k) * (1 + .5 * np.sin(k * 11 + seed))
        x[int(t * SR)] = (.4 + r.random() * .6) * np.sin(np.pi * k) ** .5
        t += 1 / max(rate, 3) * (1 + (r.random() - .5) * jitter)
    y = resonate(x, res, q, [1, .7, .45, .3][:len(res)])
    return lowpass(y, 5000) / (np.max(np.abs(y)) + 1e-9)


def noise_burst(dur, hp=1500):
    t = tt(dur)
    return highpass(rng.standard_normal(len(t)), hp) * np.exp(-t * 60)


# ---------------------------------------------------------------------------
# 0 – 4.6 s : LA MAISON
# ---------------------------------------------------------------------------
t = tt(DUR)
# vent (deux canaux indépendants), fort au début, discret ensuite
for ch, seed in ((0, 1), (1, 2)):
    w = np.random.default_rng(seed).standard_normal(N)
    w = sweep_bp(w, 280, 700, q=1.5, curve=lambda k: .5 + .5 * np.sin(k * 9 + seed))
    amp = (.55 + .45 * np.sin(t * .9 + seed * 2) * np.sin(t * .37 + seed)) * (.25 + .75 * (1 - P(t, 3.5, 5.0)) + .35 * P(t, 11.3, 12))
    amp *= 1 - P(t, 14.3, 15)
    DRY[ch] += w * amp * .30
# nappe grave (mi) qui accompagne tout le film
drone = sum(a * np.sin(2 * np.pi * f * t + p) for f, a, p in [(41.2, 1, 0), (41.5, .7, 1), (61.74, .5, 2), (82.4, .3, 3)])
drone = np.tanh(drone * .9) * (.10 + .08 * P(t, 0, 3) + .12 * P(t, 9.0, 10.55) * (t < 10.58) - .05 * P(t, 4.6, 5))
drone *= 1 - P(t, 14.2, 15)
DRY += drone * .5
# grelots de traîneau, au loin
for i in range(26):
    tb = .35 + i * .065 + rng.random() * .03
    j = sum(np.sin(2 * np.pi * f * tt(.09)) for f in rng.uniform(4200, 8800, 4)) * np.exp(-tt(.09) * 55)
    add(j, tb, .035 * np.sin(np.pi * i / 26), pan=.5, rev=1.0)

# valse de boîte à musique (mi mineur, 3/4) — qui se dérègle et meurt à 7.3–8.4 s
BEAT = 60 / 144
MEL = [(0, 76, 1), (1, 79, 1), (2, 83, 1), (3, 82, 1), (4, 83, 1), (5, 84, 1), (6, 83, 2), (8, 79, 1), (9, 78, 3),
       (12, 76, 1), (13, 79, 1), (14, 83, 1), (15, 84, 1), (16, 83, 1), (17, 79, 1), (18, 75, 1), (19, 78, 1), (20, 81, 1),
       (21, 79, 1), (22, 78, 1), (23, 76, 3)]
BARS = [(40, [59, 64, 67]), (48, [60, 64, 68]), (40, [59, 64, 67]), (35, [59, 63, 69]),
        (40, [59, 64, 67]), (45, [57, 60, 64]), (35, [59, 63, 66, 69]), (40, [59, 64, 67])]
# carte tempo : la boîte à musique ralentit et se désaccorde
tm, beats, tcur, m = [], [], .55, 0.0
while tcur < 8.6:
    tm.append(tcur); beats.append(m)
    rate = 1 - .7 * P(tcur, 7.3, 8.4)
    m += rate * .001 / BEAT
    tcur += .001
tm, beats = np.array(tm), np.array(beats)


def beat_time(b):
    i = np.searchsorted(beats, b)
    return tm[i] if i < len(tm) else None


def play_box(beat, midi, gain, pan=0.0):
    tb = beat_time(beat)
    if tb is None or tb > 8.4:
        return
    detune = 1 - .08 * P(tb, 7.3, 8.4) + rng.normal(0, .002)
    add(music_box(mf(midi) * detune), tb, gain * (1 - .5 * P(tb, 7.6, 8.4)), pan=pan, rev=.55)


for b, mi, d in MEL:
    play_box(b, mi, .30, pan=-.15)
for i, (bass, chord) in enumerate(BARS):
    for k in (1, 2):
        for c in chord:
            play_box(i * 3 + k, c + 12, .07, pan=.25)
    tb = beat_time(i * 3)
    if tb is not None and 4.6 < tb < 7.8:  # la basse entre dans la boutique
        add(pizz(mf(bass)), tb, .5, pan=0, rev=.2)

# loquet
for tc in (1.74, 1.83, 1.93):
    add(resonate(noise_burst(.12, 1000), [2300, 3700, 5200], 25), tc, .18, pan=-.1, rev=.4)
# la porte grince
add(creak(1.35, 18, 55, [430, 980, 1750, 2600], q=16, seed=3), 2.0, .45, pan=-.15, rev=.5)
# souffle : on est aspiré par la porte
w = rng.standard_normal(int(1.55 * SR))
w = sweep_bp(w, 180, 2600, q=1.2, curve=lambda k: k ** 2)
env = P(tt(1.55), 0, 1.5) ** 2.2 * (1 - P(tt(1.55), 1.5, 1.55))
add(w * env, 3.05, .8, rev=.4)
add(boom(65, 34, 1.6), 4.58, .55, rev=.5)
for i, mi in enumerate([88, 91, 95, 100]):  # scintillement d'entrée
    add(music_box(mf(mi)), 4.62 + i * .05, .08, pan=(i - 1.5) * .4, rev=1.0)

# ---------------------------------------------------------------------------
# 4.6 – 8.6 s : LA BOUTIQUE
# ---------------------------------------------------------------------------
add(choir([52, 59, 64, 67], 3.6, .12, lp=1000) * np.minimum(1, tt(3.6) / 1.2) * (1 - P(tt(3.6), 2.6, 3.6)), 4.7, 1, rev=.8)
# papiers qui virevoltent
rust = highpass(rng.standard_normal(int(3.6 * SR)), 2500)
crackles = (rng.random(len(rust)) < 30 / SR).astype(float)
crackles = signal.lfilter([1], [1, -.995], crackles)
add(rust * crackles * .5 * (1 - P(tt(3.6), 2.8, 3.6)), 4.7, .35, pan=.2, rev=.3)
# lampes : bourdonnement, grésillement, puis claquent une à une
for i in range(5):
    death = 7.15 + i * .2
    d0 = death - .45
    tb = tt(.7)
    hum = sum(np.sin(2 * np.pi * 100 * n * tb) / n for n in range(1, 14))
    gate = (np.random.default_rng(i).random(len(tb) // 1200 + 1) < .55).repeat(1200)[:len(tb)]
    gate = lowpass(gate.astype(float), 300) * (tb > .45) + (tb <= .45)
    hum = bandpass(hum, 400, 3500) * gate * np.minimum(1, tb / .2)
    add(hum, d0, .05, pan=(i - 2) * .35, rev=.2)
    add(noise_burst(.05, 800), death + .25, .22, pan=(i - 2) * .35, rev=.6)
    add(boom(90, 50, .25), death + .25, .11, pan=(i - 2) * .35, rev=.6)

# ---------------------------------------------------------------------------
# 8.6 – 11.3 s : LE CASSE-NOISETTE
# ---------------------------------------------------------------------------
for tc, on in ((8.64, 1), (8.70, 0), (8.80, 1), (8.89, 0), (9.02, 1)):  # relais de l'ampoule
    add(resonate(noise_burst(.03, 1500), [1800, 3200], 20), tc, .25 if on else .12, rev=.3)
ts = tt(1.6)
hum = sum(np.sin(2 * np.pi * 50 * n * ts) / n for n in range(1, 8))
add(lowpass(hum, 600) * np.minimum(1, ts / .05) * (1 - P(ts, 1.5, 1.6)), 9.02, .04, rev=.2)
# cordes aiguës dissonantes qui montent
ts = tt(1.58)
cl = sum(np.sin(2 * np.pi * f * ts) for f in (1318.5, 1396.9, 1480.0 * .5))
cl *= (.6 + .4 * np.sin(2 * np.pi * 7 * ts)) * P(ts, 0, 1.5) ** 2
add(cl, 9.0, .05, rev=.6)
# coeur qui bat
for tb in (9.1, 9.72, 10.25):
    for dt, g in ((0, 1), (.2, .6)):
        add(boom(58, 38, .45), tb + dt, .35 * g, rev=.15)
# la mâchoire en bois s'ouvre
add(creak(.9, 9, 28, [240, 560, 1150], q=10, seed=9, jitter=.6), 9.58, .5, rev=.35)
# CRAC !
crack = np.zeros(int(.9 * SR))
for k in range(7):
    i0 = int((k * .004 + rng.random() * .003) * SR)
    b = noise_burst(.02, 1200)
    crack[i0:i0 + len(b)] += b * (1 - k / 9)
crack = crack + .9 * resonate(crack, [720, 1180, 2350], 12)
add(np.tanh(crack * 2.5), 10.6, .7, rev=.9)
add(boom(80, 30, 1.8), 10.6, .9, rev=.7)
# aspiration à l'envers vers le sapin
rs = highpass(rng.standard_normal(int(.45 * SR)), 1500) * np.exp(-tt(.45) * 6)
add(rs[::-1], 10.86, .35, rev=.6)

# ---------------------------------------------------------------------------
# 11.3 – 15 s : LE SAPIN ET LE TITRE
# ---------------------------------------------------------------------------
add(boom(60, 30, 2.4), 11.3, .7, rev=.8)
ch = choir([40, 52, 59, 64, 67, 71], 3.7, .28, lp=1600)
add(ch * np.minimum(1, tt(3.7) / .4) * (1 - P(tt(3.7), 2.9, 3.7)), 11.3, 1, rev=.9)
for i, (tb, mi) in enumerate([(11.55, 76), (11.9, 79), (12.25, 83), (12.6, 88)]):
    add(music_box(mf(mi), 3.0), tb, .30, pan=-.1, rev=.8)
for i, mi in enumerate([88, 91, 95, 100, 103, 107]):  # l'étoile s'embrase
    add(music_box(mf(mi), 2.5), 12.3 + i * .045, .09, pan=(i - 2.5) * .3, rev=1.2)
add(bell(mf(52), 3.5), 12.5, .25, rev=1.0)   # le titre
add(bell(mf(64), 2.5), 13.3, .10, pan=.2, rev=1.0)

# ---------------------------------------------------------------------------
# MIXAGE
# ---------------------------------------------------------------------------
ti = tt(3.2)
ir = np.stack([np.random.default_rng(s).standard_normal(len(ti)) for s in (11, 12)]) * np.exp(-ti / .75)
ir = lowpass(ir, 5500)
ir[:, :int(.02 * SR)] = 0
wet = np.stack([signal.fftconvolve(SEND[c], ir[c])[:N] for c in range(2)])
wet /= np.max(np.abs(wet)) + 1e-9
mix = DRY + wet * .45 * np.max(np.abs(DRY))
mix = highpass(mix, 28)
mix[:, -int(.05 * SR):] *= np.linspace(1, 0, int(.05 * SR))
mix = np.tanh(mix / np.max(np.abs(mix)) * 1.3)
mix = mix / np.max(np.abs(mix)) * .89

os.makedirs(os.path.join(os.path.dirname(__file__) or ".", "export"), exist_ok=True)
out = os.path.join(os.path.dirname(__file__) or ".", "export", "bande-son.wav")
wavfile.write(out, SR, (mix.T * 32767).astype(np.int16))
print("OK", out)
