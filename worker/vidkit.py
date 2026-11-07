"""vidkit — small, reliable video helpers for AI-written editing scripts.

Every function takes input paths and writes an output path, using ffmpeg under
the hood. Text is rendered with Pillow (full Romanian diacritics support), so no
ffmpeg text escaping is ever needed.

Default output format: H.264 + AAC, 30 fps, 720x1280 (9:16 vertical).
"""
from __future__ import annotations

import json
import os
import subprocess
import tempfile
import textwrap
from typing import Iterable, Sequence

from PIL import Image, ImageDraw, ImageFont

__all__ = [
    "W", "H", "FPS", "probe", "fit", "trim", "concat", "text_overlay", "captions",
    "image_clip", "end_card", "add_audio", "mute", "speed", "loop_to", "run_ffmpeg",
]

W, H, FPS = 720, 1280, 30
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
_ENC = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2", "-movflags", "+faststart"]


def run_ffmpeg(args: Sequence[str]) -> None:
    """Run ffmpeg with the given arguments (without the leading 'ffmpeg'). Raises on failure."""
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *map(str, args)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {' '.join(cmd)}\n{r.stderr[-2000:]}")


def probe(path: str) -> dict:
    """Return {'duration': s, 'width': px, 'height': px, 'fps': f, 'has_audio': bool}."""
    r = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", path],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"ffprobe failed for {path}: {r.stderr}")
    d = json.loads(r.stdout)
    v = next((s for s in d.get("streams", []) if s.get("codec_type") == "video"), {})
    a = any(s.get("codec_type") == "audio" for s in d.get("streams", []))
    fps = 0.0
    if v.get("avg_frame_rate", "0/0") != "0/0":
        n, m = v["avg_frame_rate"].split("/")
        fps = float(n) / float(m) if float(m) else 0.0
    return {
        "duration": float(d.get("format", {}).get("duration", 0) or 0),
        "width": int(v.get("width", 0) or 0),
        "height": int(v.get("height", 0) or 0),
        "fps": round(fps, 2),
        "has_audio": a,
    }


def _silence_args(duration: float) -> list[str]:
    return ["-f", "lavfi", "-t", f"{duration:.3f}", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"]


def fit(src: str, dst: str, w: int = W, h: int = H, mode: str = "cover") -> str:
    """Normalise a clip to w x h @ 30 fps with a stereo audio track (silent if missing).

    mode='cover' crops to fill the frame; mode='contain' letterboxes on a blurred background.
    Always run clips through fit() before concat().
    """
    info = probe(src)
    if mode == "contain":
        vf = (f"[0:v]split[a][b];[a]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},boxblur=20:5[bg];"
              f"[b]scale={w}:{h}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,fps={FPS},setsar=1[v]")
    else:
        vf = f"[0:v]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},fps={FPS},setsar=1[v]"
    args = ["-i", src]
    if info["has_audio"]:
        args += ["-filter_complex", vf, "-map", "[v]", "-map", "0:a:0"]
    else:
        args += [*_silence_args(info["duration"] or 1), "-filter_complex", vf, "-map", "[v]", "-map", "1:a", "-shortest"]
    run_ffmpeg([*args, *_ENC, dst])
    return dst


def trim(src: str, dst: str, start: float = 0.0, end: float | None = None) -> str:
    """Cut [start, end) seconds out of src (re-encodes for frame accuracy)."""
    args = ["-ss", f"{start:.3f}", "-i", src]
    if end is not None:
        args += ["-t", f"{max(0.05, end - start):.3f}"]
    run_ffmpeg([*args, *_ENC, dst])
    return dst


def concat(srcs: Sequence[str], dst: str, transition: str | None = None, transition_duration: float = 0.4) -> str:
    """Join clips in order. Inputs must share size/fps (use fit() first).

    transition=None → hard cuts; transition='fade' (or any ffmpeg xfade name such as 'slideleft',
    'wipeup', 'circleopen') → cross transitions of transition_duration seconds.
    """
    srcs = list(srcs)
    if not srcs:
        raise ValueError("concat: no inputs")
    if len(srcs) == 1:
        run_ffmpeg(["-i", srcs[0], *_ENC, dst])
        return dst
    args: list[str] = []
    for s in srcs:
        args += ["-i", s]
    if not transition:
        parts = "".join(f"[{i}:v][{i}:a]" for i in range(len(srcs)))
        fc = f"{parts}concat=n={len(srcs)}:v=1:a=1[v][a]"
    else:
        durs = [probe(s)["duration"] for s in srcs]
        td = min(transition_duration, *(d / 2 for d in durs))
        fc_parts, vprev, aprev, offset = [], "[0:v]", "[0:a]", 0.0
        for i in range(1, len(srcs)):
            offset += durs[i - 1] - td
            vout, aout = f"[v{i}]", f"[a{i}]"
            fc_parts.append(f"{vprev}[{i}:v]xfade=transition={transition}:duration={td:.3f}:offset={offset:.3f}{vout}")
            fc_parts.append(f"{aprev}[{i}:a]acrossfade=d={td:.3f}{aout}")
            vprev, aprev = vout, aout
        fc = ";".join(fc_parts) + f";{vprev}null[v];{aprev}anull[a]"
    run_ffmpeg([*args, "-filter_complex", fc, "-map", "[v]", "-map", "[a]", *_ENC, dst])
    return dst


def _text_png(text: str, width: int, size: int, color: str, box: bool, box_color: str, bold: bool,
              align: str = "center") -> str:
    font = ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size)
    avg = max(1, int(font.getlength("abcdefghijklmnopqrstuvwxyz") / 26))
    wrap = max(8, int((width * 0.86) // avg))
    lines: list[str] = []
    for para in text.split("\n"):
        lines += textwrap.wrap(para, wrap) or [""]
    line_h = int(size * 1.25)
    pad = int(size * 0.5)
    text_w = max((int(font.getlength(l)) for l in lines), default=0)
    img_w = min(width, text_w + 2 * pad)
    img_h = line_h * len(lines) + 2 * pad
    img = Image.new("RGBA", (img_w, img_h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if box:
        d.rounded_rectangle([0, 0, img_w - 1, img_h - 1], radius=int(size * 0.4), fill=box_color)
    for i, l in enumerate(lines):
        lw = font.getlength(l)
        x = (img_w - lw) / 2 if align == "center" else pad
        y = pad + i * line_h
        if not box:  # outline for legibility without a box
            d.text((x, y), l, font=font, fill=color, stroke_width=max(2, size // 14), stroke_fill="black")
        else:
            d.text((x, y), l, font=font, fill=color)
    fd, path = tempfile.mkstemp(suffix=".png")
    os.close(fd)
    img.save(path)
    return path


_POS = {
    "top": "(W-w)/2:H*0.08",
    "center": "(W-w)/2:(H-h)/2",
    "bottom": "(W-w)/2:H*0.80-h",
    "lower_third": "(W-w)/2:H*0.66",
}


def text_overlay(src: str, dst: str, text: str, start: float = 0.0, end: float | None = None,
                 position: str = "bottom", size: int = 52, color: str = "white", box: bool = True,
                 box_color: str = "#000000B3", bold: bool = True) -> str:
    """Burn a (word-wrapped) text box into src between start and end seconds.

    position: 'top' | 'center' | 'bottom' | 'lower_third'. color/box_color accept CSS-like hex (#RRGGBB or #RRGGBBAA) or names.
    """
    info = probe(src)
    end = info["duration"] if end is None else end
    png = _text_png(text, info["width"] or W, size, color, box, box_color, bold)
    pos = _POS.get(position, _POS["bottom"])
    fc = f"[0:v][1:v]overlay={pos}:enable='between(t,{start:.3f},{end:.3f})'[v]"
    args = ["-i", src, "-i", png, "-filter_complex", fc, "-map", "[v]"]
    args += ["-map", "0:a:0"] if info["has_audio"] else []
    run_ffmpeg([*args, *_ENC, dst])
    os.unlink(png)
    return dst


def captions(src: str, dst: str, items: Iterable[tuple[float, float, str]], position: str = "bottom",
             size: int = 48, color: str = "white", box: bool = True, box_color: str = "#000000B3") -> str:
    """Burn several timed captions: items = [(start, end, text), ...]."""
    items = list(items)
    if not items:
        run_ffmpeg(["-i", src, *_ENC, dst])
        return dst
    info = probe(src)
    pngs = [_text_png(t, info["width"] or W, size, color, box, box_color, True) for _, _, t in items]
    args = ["-i", src]
    for p in pngs:
        args += ["-i", p]
    pos = _POS.get(position, _POS["bottom"])
    chain, prev = [], "[0:v]"
    for i, (s, e, _) in enumerate(items, start=1):
        out = f"[c{i}]"
        chain.append(f"{prev}[{i}:v]overlay={pos}:enable='between(t,{s:.3f},{e:.3f})'{out}")
        prev = out
    fc = ";".join(chain) + f";{prev}null[v]"
    args += ["-filter_complex", fc, "-map", "[v]"]
    args += ["-map", "0:a:0"] if info["has_audio"] else []
    run_ffmpeg([*args, *_ENC, dst])
    for p in pngs:
        os.unlink(p)
    return dst


def image_clip(image: str, dst: str, duration: float = 3.0, zoom: bool = True, w: int = W, h: int = H) -> str:
    """Turn a still image into a clip (slow Ken Burns zoom if zoom=True), with silent audio."""
    frames = max(1, int(duration * FPS))
    if zoom:
        vf = (f"scale={w*2}:{h*2}:force_original_aspect_ratio=increase,crop={w*2}:{h*2},"
              f"zoompan=z='min(zoom+0.0015,1.15)':d={frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={w}x{h}:fps={FPS},setsar=1")
    else:
        vf = f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},fps={FPS},setsar=1"
    run_ffmpeg(["-loop", "1", "-t", f"{duration:.3f}", "-i", image, *_silence_args(duration),
                "-vf", vf, "-map", "0:v", "-map", "1:a", "-t", f"{duration:.3f}", *_ENC, dst])
    return dst


def end_card(dst: str, lines: Sequence[str], duration: float = 2.5, image: str | None = None,
             bg: str = "#111111", color: str = "white", accent: str = "#FFB800", w: int = W, h: int = H) -> str:
    """Create a closing card: optional product image on top, then text lines.

    The first line is drawn large in the accent color (e.g. the price or the CTA), the rest smaller.
    """
    canvas = Image.new("RGB", (w, h), bg)
    d = ImageDraw.Draw(canvas)
    y = int(h * 0.12)
    if image:
        im = Image.open(image).convert("RGBA")
        im.thumbnail((int(w * 0.8), int(h * 0.42)))
        canvas.paste(im, ((w - im.width) // 2, y), im)
        y += im.height + int(h * 0.05)
    else:
        y = int(h * 0.35)
    for i, line in enumerate(lines):
        size = 72 if i == 0 else 44
        font = ImageFont.truetype(FONT_BOLD, size)
        for part in textwrap.wrap(line, max(8, int(w * 0.9 // (size * 0.55)))) or [""]:
            lw = d.textlength(part, font=font)
            d.text(((w - lw) / 2, y), part, font=font, fill=accent if i == 0 else color)
            y += int(size * 1.3)
        y += int(h * 0.015)
    fd, png = tempfile.mkstemp(suffix=".png")
    os.close(fd)
    canvas.save(png)
    image_clip(png, dst, duration=duration, zoom=False, w=w, h=h)
    os.unlink(png)
    return dst


def add_audio(src: str, audio: str, dst: str, volume: float = 0.6, keep_original: bool = True) -> str:
    """Add a music/voice track (trimmed to the video). keep_original mixes it with the clip's own audio."""
    info = probe(src)
    if keep_original and info["has_audio"]:
        fc = f"[1:a]volume={volume}[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=0[a]"
    else:
        fc = f"[1:a]volume={volume},apad[a]"
    run_ffmpeg(["-i", src, "-i", audio, "-filter_complex", fc, "-map", "0:v", "-map", "[a]",
                "-t", f"{info['duration']:.3f}", *_ENC, dst])
    return dst


def mute(src: str, dst: str) -> str:
    """Replace the audio with silence (keeps an audio track so concat still works)."""
    info = probe(src)
    run_ffmpeg(["-i", src, *_silence_args(info["duration"] or 1), "-map", "0:v", "-map", "1:a", "-shortest", *_ENC, dst])
    return dst


def speed(src: str, dst: str, factor: float) -> str:
    """Speed up (factor > 1) or slow down (factor < 1) video and audio. 0.5 <= factor <= 2."""
    factor = max(0.5, min(2.0, factor))
    info = probe(src)
    fc = f"[0:v]setpts=PTS/{factor}[v]"
    args = ["-i", src]
    if info["has_audio"]:
        fc += f";[0:a]atempo={factor}[a]"
        args += ["-filter_complex", fc, "-map", "[v]", "-map", "[a]"]
    else:
        args += ["-filter_complex", fc, "-map", "[v]"]
    run_ffmpeg([*args, *_ENC, dst])
    return dst


def loop_to(src: str, dst: str, duration: float) -> str:
    """Loop a clip until it reaches `duration` seconds."""
    run_ffmpeg(["-stream_loop", "-1", "-i", src, "-t", f"{duration:.3f}", *_ENC, dst])
    return dst
