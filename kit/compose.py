"""Earthfolk portrait compositor: pure PNG layer stacking.

Deterministic and reproducible forever: pre-positioned transparent PNG
layers from assets/ are alpha-composited bottom-to-top. No AI at compose
time; regenerating a character always yields the identical image.
"""

import os
from PIL import Image

KIT_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(KIT_DIR, "assets")
CANVAS_SIZE = (48, 52)
SCALE = 10


def load_layer(name):
    path = os.path.join(ASSETS, name + ".png")
    if os.path.exists(path):
        return Image.open(path).convert("RGBA")
    return Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))


def compose_agent_portrait(pedestal, body, head, hair=None, hat=None, accessory=None):
    canvas = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    layers = [f"pedestals/{pedestal}", f"bodies/{body}", f"heads/{head}"]
    if hair:
        layers.append(f"hair/{hair}")
    if hat:
        layers.append(f"hats/{hat}")
    if accessory:
        layers.append(f"accessories/{accessory}")
    for layer in layers:
        canvas = Image.alpha_composite(canvas, load_layer(layer))
    return canvas


def save_crisp_render(img, output_path, background=(255, 255, 255, 255)):
    big = img.resize((CANVAS_SIZE[0] * SCALE, CANVAS_SIZE[1] * SCALE), Image.NEAREST)
    out = Image.new("RGBA", big.size, background)
    out.alpha_composite(big)
    out.convert("RGB").save(output_path)
    print("saved", output_path)


def save_transparent(img, output_path):
    img.resize((CANVAS_SIZE[0] * SCALE, CANVAS_SIZE[1] * SCALE), Image.NEAREST).save(output_path)
    print("saved", output_path)


# The founding committee - every part below is earned by a verified role.
COMMITTEE = {
    "sam": dict(pedestal="pedestal_grass", body="body_amber_tunic",
                head="head_light_chibi", hair="hair_brown_wavy", hat="hat_crown_gold"),
    "aegis": dict(pedestal="pedestal_grass", body="body_officer_red",
                  head="head_light_chibi", hair="hair_sideburns",
                  hat="hat_officer_cap", accessory="acc_shield"),
    "tock": dict(pedestal="pedestal_grass", body="body_engineer_vest",
                 head="head_light_chibi", hair="hair_brown_wavy", hat="hat_goggles"),
    "sage": dict(pedestal="pedestal_grass", body="body_bard_vest",
                 head="head_light_chibi", hair="hair_sideburns", hat="hat_bard_beret"),
    "atlas": dict(pedestal="pedestal_grass", body="body_scholar_robe",
                  head="head_light_chibi", hair="hair_sideburns", hat="hat_grad_cap"),
    "terra": dict(pedestal="pedestal_grass", body="body_citizen_blue",
                  head="head_light_chibi", hair="hair_purple_bob"),
}


def contact_sheet(portraits, columns=3, gap=24):
    cell_w = CANVAS_SIZE[0] * SCALE
    cell_h = CANVAS_SIZE[1] * SCALE
    rows = (len(portraits) + columns - 1) // columns
    sheet = Image.new("RGBA", (columns * cell_w + gap * (columns + 1),
                               rows * cell_h + gap * (rows + 1)), (255, 255, 255, 255))
    for index, img in enumerate(portraits):
        big = img.resize((cell_w, cell_h), Image.NEAREST)
        col, row = index % columns, index // columns
        sheet.alpha_composite(big, (gap + col * (cell_w + gap), gap + row * (cell_h + gap)))
    return sheet


if __name__ == "__main__":
    out_dir = os.path.join(KIT_DIR, "..", "committee")
    os.makedirs(out_dir, exist_ok=True)
    rendered = []
    for name, spec in COMMITTEE.items():
        portrait = compose_agent_portrait(**spec)
        rendered.append(portrait)
        save_transparent(portrait, os.path.join(out_dir, f"{name}.png"))
    sheet = contact_sheet(rendered)
    sheet.convert("RGB").save(os.path.join(KIT_DIR, "..", "..", "demo", "kit-committee.png"))
    print("saved committee contact sheet")
