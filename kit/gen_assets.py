"""One-time bakery: renders each part grid to a pre-positioned transparent
PNG on the shared 48x52 canvas, so compose.py can stack layers with plain
alpha_composite and zero offset math. Re-run any time a grid changes; when
the Renderfull AI API is available, its output replaces these PNGs 1:1.
"""

import os
from PIL import Image

from palette import PALETTE
from parts import GRIDS

CANVAS_SIZE = (48, 52)
CX = CANVAS_SIZE[0] // 2

# Where each part sits on the shared canvas: (grid name -> top-left x, y).
POSITIONS = {
    "heads/head_light_chibi": (CX - 14, 10),
    "hair/hair_brown_wavy": (CX - 14, 10),
    "hair/hair_sideburns": (CX - 14, 15),
    "hair/hair_purple_bob": (CX - 14, 10),
    "hats/hat_crown_gold": (CX - 12, 5),
    "hats/hat_officer_cap": (CX - 13, 8),
    "hats/hat_goggles": (CX - 13, 12),
    "hats/hat_bard_beret": (CX - 14, 6),
    "hats/hat_grad_cap": (CX - 16, 5),
    "bodies/body_amber_tunic": (CX - 12, 26),
    "bodies/body_officer_red": (CX - 12, 26),
    "bodies/body_engineer_vest": (CX - 12, 26),
    "bodies/body_bard_vest": (CX - 12, 26),
    "bodies/body_scholar_robe": (CX - 12, 26),
    "bodies/body_citizen_blue": (CX - 12, 26),
    "accessories/acc_shield": (CX - 18, 29),
}


def bake_grid(rows, offset):
    img = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    ox, oy = offset
    for dy, row in enumerate(rows):
        for dx, key in enumerate(row):
            if key == ".":
                continue
            x, y = ox + dx, oy + dy
            if 0 <= x < CANVAS_SIZE[0] and 0 <= y < CANVAS_SIZE[1]:
                img.putpixel((x, y), PALETTE[key] + (255,))
    return img


def bake_pedestal():
    """Isometric grass block: green diamond top, brown earth sides, outlined."""
    img = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    half_w, half_h, depth = 19, 7, 5
    center_y = 40
    for dy in range(-half_h, half_h + 1):
        span = int(half_w * (1 - abs(dy) / half_h))
        for dx in range(-span, span + 1):
            img.putpixel((CX + dx, center_y + dy), PALETTE["G"] + (255,))
    for dy in range(0, half_h + 1):
        span = int(half_w * (1 - dy / half_h))
        y = center_y + dy
        for extra in range(1, depth + 1):
            for dx in range(-span, span + 1):
                px, py = CX + dx, y + extra
                if 0 <= px < CANVAS_SIZE[0] and 0 <= py < CANVAS_SIZE[1] and img.getpixel((px, py))[3] == 0:
                    img.putpixel((px, py), PALETTE["U" if dx < 0 else "u"] + (255,))
    silhouette = img.copy()
    for x in range(CANVAS_SIZE[0]):
        for y in range(CANVAS_SIZE[1]):
            if silhouette.getpixel((x, y))[3] == 0:
                continue
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if not (0 <= nx < CANVAS_SIZE[0] and 0 <= ny < CANVAS_SIZE[1]) \
                        or silhouette.getpixel((nx, ny))[3] == 0:
                    img.putpixel((x, y), PALETTE["O"] + (255,))
                    break
    for tx, ty in [(-11, 37), (-5, 35), (2, 42), (9, 36), (13, 41), (-14, 41), (5, 34)]:
        for px, py in ((CX + tx, ty), (CX + tx + 1, ty), (CX + tx, ty + 1)):
            if img.getpixel((px, py))[:3] == PALETTE["G"]:
                img.putpixel((px, py), PALETTE["d"] + (255,))
    return img


def main():
    root = os.path.join(os.path.dirname(__file__), "assets")
    for name, rows in GRIDS.items():
        path = os.path.join(root, name + ".png")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        bake_grid(rows, POSITIONS[name]).save(path)
        print("baked", name)
    pedestal_path = os.path.join(root, "pedestals", "pedestal_grass.png")
    os.makedirs(os.path.dirname(pedestal_path), exist_ok=True)
    bake_pedestal().save(pedestal_path)
    print("baked pedestals/pedestal_grass")


if __name__ == "__main__":
    main()
