"""Contact sheet of the Renderful committee renders, laid out like the
user's reference (3 columns x 2 rows on white)."""

import os
from PIL import Image

KIT_DIR = os.path.dirname(os.path.abspath(__file__))
ORDER = ["sam", "aegis", "tock", "sage", "atlas", "terra"]
CELL = 340
GAP = 20

sheet = Image.new("RGB", (3 * CELL + 4 * GAP, 2 * CELL + 3 * GAP), (255, 255, 255))
for index, name in enumerate(ORDER):
    path = os.path.join(KIT_DIR, "renders", f"{name}.png")
    if not os.path.exists(path):
        continue
    img = Image.open(path).convert("RGB").resize((CELL, CELL), Image.LANCZOS)
    col, row = index % 3, index // 3
    sheet.paste(img, (GAP + col * (CELL + GAP), GAP + row * (CELL + GAP)))
out = os.path.join(KIT_DIR, "..", "..", "demo", "kit-committee-ai.png")
sheet.save(out)
print("saved", out)
