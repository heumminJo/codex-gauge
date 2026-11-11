#!/usr/bin/env python3
"""Generate the app icon using only Python's standard library."""

import math
import struct
import zlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "build"
SIZE = 1024


def circle_coverage(distance, radius):
    return max(0.0, min(1.0, radius + 0.5 - distance))


def png_chunk(tag, data):
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def make_png():
    rows = []
    for y in range(SIZE):
        row = bytearray([0])
        for x in range(SIZE):
            dx = x - 511.5
            dy = y - 511.5
            qx = abs(dx) - 350
            qy = abs(dy) - 350
            rounded = math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - 115
            background = max(0.0, min(1.0, 0.5 - rounded))
            radius = math.hypot(dx, dy)
            angle = math.degrees(math.atan2(dy, dx)) % 360
            on_arc = ((angle - 135) % 360) <= 270
            ring = max(0.0, min(1.0, 34.5 - abs(radius - 270))) if on_arc else 0.0
            # Distance to the needle segment from the center to the upper right.
            vx, vy = 178, -128
            projection = max(0.0, min(1.0, (dx * vx + dy * vy) / (vx * vx + vy * vy)))
            needle_distance = math.hypot(dx - projection * vx, dy - projection * vy)
            needle = circle_coverage(needle_distance, 25)
            hub = circle_coverage(radius, 42)
            accent = max(ring, needle, hub)
            alpha = round(background * 255)
            if accent:
                color = (91, 216, 188)
            else:
                color = (20, 31, 50)
            row.extend((*color, alpha))
        rows.append(bytes(row))
    raw = b"".join(rows)
    png = b"\x89PNG\r\n\x1a\n"
    png += png_chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0))
    png += png_chunk(b"IDAT", zlib.compress(raw, 9))
    png += png_chunk(b"IEND", b"")
    return png


def main():
    BUILD.mkdir(exist_ok=True)
    (BUILD / "icon.png").write_bytes(make_png())


if __name__ == "__main__":
    main()
