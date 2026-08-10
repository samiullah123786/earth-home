"""Pixelize soft AI renders into crisp true pixel art.

Downsamples to a real pixel grid, quantizes to a small flat palette (cel
shading), then hard-upscales with NEAREST. Deterministic for a given input.
"""

import os
import sys
from PIL import Image

KIT_DIR = os.path.dirname(os.path.abspath(__file__))
GRID = 112          # true pixel resolution of the final sprite
COLORS = 28         # flat palette size - keeps cel shading, kills gradients
OUT_SIZE = 896      # GRID * 8


def pixelize(src_path, out_path):
    img = Image.open(src_path).convert("RGB")
    small = img.resize((GRID, GRID), Image.BOX)
    flat = small.quantize(colors=COLORS, method=Image.MEDIANCUT, dither=Image.NONE)
    big = flat.convert("RGB").resize((OUT_SIZE, OUT_SIZE), Image.NEAREST)
    big.save(out_path)
    print("pixelized", out_path)


if __name__ == "__main__":
    for name in (sys.argv[1:] or ["sam"]):
        pixelize(os.path.join(KIT_DIR, "renders", f"{name}.png"),
                 os.path.join(KIT_DIR, "renders", f"{name}_pixel.png"))
