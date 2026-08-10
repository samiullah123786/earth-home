"""Earthfolk portrait kit: hand-placed chibi pixel characters, code-drawn.

Layered and deterministic: base body + hair + headgear + outfit parts are
composed per character, rendered onto an isometric grass pedestal, and
upscaled with hard pixels (no smoothing). No AI generation, no credits,
reproducible forever - every part is earned by a verified role or family.
"""

from PIL import Image

SCALE = 10
CANVAS_W, CANVAS_H = 52, 58

PALETTE = {
    "O": (43, 28, 18),      # warm ink outline
    "S": (246, 207, 164),   # skin
    "s": (224, 177, 132),   # skin shadow
    "B": (242, 160, 154),   # blush
    "E": (43, 35, 32),      # eye
    "e": (255, 255, 255),   # eye highlight
    "W": (255, 255, 255),   # white
    "H": (138, 90, 51),     # hair brown
    "h": (169, 118, 72),    # hair highlight
    "C": (247, 201, 72),    # gold
    "c": (217, 154, 31),    # gold shadow
    "g": (232, 114, 42),    # gem orange
    "T": (201, 138, 46),    # amber tunic
    "t": (168, 111, 31),    # tunic shadow
    "P": (154, 107, 63),    # trousers tan
    "b": (93, 58, 33),      # boots dark brown
    "G": (88, 192, 77),     # grass bright
    "d": (62, 143, 58),     # grass speckle
    "U": (138, 90, 51),     # earth light side
    "u": (111, 67, 40),     # earth dark side
}


def blank():
    return Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))


def put(img, x, y, key):
    if 0 <= x < CANVAS_W and 0 <= y < CANVAS_H and key != ".":
        img.putpixel((x, y), PALETTE[key] + (255,))


def draw_rows(img, rows, ox, oy):
    for dy, row in enumerate(rows):
        for dx, key in enumerate(row):
            put(img, ox + dx, oy + dy, key)


# ---------------------------------------------------------------- pedestal
def draw_pedestal(img):
    """Isometric diamond grass block: green top, brown left/right sides."""
    cx, top_y = CANVAS_W // 2, 40
    half_w, half_h = 20, 8
    # top diamond (grass)
    for dy in range(-half_h, half_h + 1):
        span = int(half_w * (1 - abs(dy) / half_h))
        for dx in range(-span, span + 1):
            put(img, cx + dx, top_y + dy + half_h - 1, "G")
    # earth sides: extrude the lower half of the diamond downward
    depth = 7
    for dy in range(0, half_h + 1):
        span = int(half_w * (1 - dy / half_h))
        y = top_y + half_h - 1 + dy
        for extra in range(1, depth + 1):
            for dx in range(-span, span + 1):
                px, py = cx + dx, y + extra
                if 0 <= px < CANVAS_W and 0 <= py < CANVAS_H and img.getpixel((px, py))[3] == 0:
                    put(img, px, py, "U" if dx < 0 else "u")
    # outline the silhouette
    silhouette = img.copy()
    for x in range(CANVAS_W):
        for y in range(CANVAS_H):
            if silhouette.getpixel((x, y))[3] == 0:
                continue
            for nx, ny in ((x-1, y), (x+1, y), (x, y-1), (x, y+1)):
                if not (0 <= nx < CANVAS_W and 0 <= ny < CANVAS_H) or silhouette.getpixel((nx, ny))[3] == 0:
                    put(img, x, y, "O")
                    break
    # grass speckle tufts on the top face
    for tx, ty in [(-11, 3), (-5, 1), (2, 5), (9, 2), (13, 5), (-14, 5), (5, 0), (-2, 6)]:
        put(img, cx + tx, top_y + ty, "d")
        put(img, cx + tx + 1, top_y + ty, "d")
        put(img, cx + tx, top_y + ty + 1, "d")


# ---------------------------------------------------------------- character
from parts import HEAD_BASE, CROWN, BODY_MAYOR, LEGS


def compose_sam():
    img = blank()
    draw_pedestal(img)
    cx = CANVAS_W // 2
    # character stack, centered; feet land ON the pedestal's top face
    draw_rows(img, LEGS, cx - 12, 41)
    draw_rows(img, BODY_MAYOR, cx - 12, 32)
    draw_rows(img, HEAD_BASE, cx - 14, 15)
    draw_rows(img, CROWN, cx - 12, 10)
    return img


def render(img, path):
    big = img.resize((CANVAS_W * SCALE, CANVAS_H * SCALE), Image.NEAREST)
    out = Image.new("RGBA", big.size, (255, 255, 255, 255))
    out.alpha_composite(big)
    out.convert("RGB").save(path)
    print("saved", path)


if __name__ == "__main__":
    render(compose_sam(), "../../demo/kit-sam.png")
