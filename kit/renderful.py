"""Renderful AI bakery: generates the committee's canonical portrait PNGs.

One-time curated generation (the kit), never per-agent at runtime: outputs
are reviewed, committed as static assets, and served forever. The API key
lives in kit/.env.local (untracked) - never in the repo or chat logs.
"""

import json
import os
import sys
import urllib.request

KIT_DIR = os.path.dirname(os.path.abspath(__file__))
API_URL = "https://api.renderful.ai/api/v1/generations"


def api_key():
    env_path = os.path.join(KIT_DIR, ".env.local")
    with open(env_path, encoding="utf-8") as handle:
        for line in handle:
            if line.startswith("RENDERFUL_API_KEY="):
                return line.split("=", 1)[1].strip()
    raise SystemExit("RENDERFUL_API_KEY missing from kit/.env.local")


STYLE = (
    "TRUE CRISP PIXEL ART sprite, hard square pixels, sharp aliased edges, absolutely no blur, no soft airbrush shading, looks like a 64x64 game sprite scaled up with nearest-neighbor. Cute chibi game character. Single character "
    "centered, standing on an isometric diamond-shaped grass block pedestal: bright green "
    "pixel grass top with small darker green tufts, chunky brown earth soil visible on the "
    "two front sides of the floating block. Pure white background, nothing else in frame. "
    "Oversized head about 45 percent of total height, large solid dark round eyes with a "
    "single white sparkle pixel, soft pink blush squares on cheeks, tiny gentle smile, "
    "short stubby arms and legs. Thick dark brown-black ink outlines around every shape, "
    "crisp clean pixel grid, flat cel shading with simple two-tone shadows, no gradients, "
    "no anti-aliasing blur. Cozy wholesome video game character. Character details: "
)

CHARACTERS = {
    "sam": (
        "A young friendly MAYOR-KING, male, light skin, fluffy warm-brown wavy hair, wearing a "
        "golden three-pointed crown with tiny orange gems, an amber-ochre tunic with a round "
        "gold medal on a cord at the chest, darker tan trousers, small brown boots."
    ),
    "aegis": (
        "A gentle KNIGHT-FRIEND of a cozy village, male, deep brown skin, short black curly "
        "hair, wearing a bright red cap, a red tunic with silver buttons and a brown belt, "
        "holding a small round shield, black boots."
    ),
    "tock": (
        "A cheerful INSPECTOR-ENGINEER, male, light skin with tiny freckles, messy ginger-orange "
        "hair, brass-rimmed goggles with cyan lenses pushed up on his forehead, a cobalt-blue "
        "work vest full of small tool pockets over a white shirt, holding a small wrench, "
        "tan work trousers, sturdy brown boots."
    ),
    "sage": (
        "A warm welcoming GREETER-BARD, male, tan skin, chin-length dark chestnut hair, wearing "
        "a plum-purple beret with one golden feather, a cream shirt under a violet vest with a "
        "tiny golden bowtie, one hand raised in a friendly wave, a small leather satchel at his "
        "hip, charcoal trousers, brown shoes."
    ),
    "atlas": (
        "A studious SURVEYOR-SCHOLAR, male, fair peachy skin, neat golden-blond hair, small round "
        "glasses, wearing a deep-green graduation cap with a gold tassel and a long emerald "
        "scholar robe, holding a rolled map scroll under one arm, dark boots peeking out."
    ),
    "terra": (
        "A gentle LAND STEWARD, female, warm tan skin, chin-length purple bob hair with soft "
        "fringe, bright green eyes, wearing an indigo-blue gardener blouse with rolled sleeves "
        "and a brown utility belt with tiny pouches, holding a small sprouting seedling, "
        "denim-blue trousers, sturdy brown boots."
    ),
}


def _request(url, body=None):
    request = urllib.request.Request(url, data=body, headers={
        "Authorization": f"Bearer {api_key()}",
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(request, timeout=180) as response:
        return json.loads(response.read().decode("utf-8"))


def generate(name, model="nano-banana-pro"):
    import time
    submitted = _request(API_URL, json.dumps({
        "type": "text-to-image", "model": model,
        "prompt": STYLE + CHARACTERS[name], "width": 1024, "height": 1024,
    }).encode("utf-8"))
    poll_url = "https://api.renderful.ai" + submitted["poll_url"]
    print(f"{name}: job {submitted['id']} ({submitted.get('cost_formatted', '?')})")
    for _ in range(90):
        time.sleep(4)
        status = _request(poll_url)
        state = status.get("status")
        if state in ("completed", "succeeded"):
            output = status.get("output")
            outputs = status.get("outputs") or []
            image_url = output if isinstance(output, str) else (outputs[0] if outputs else None)
            if not image_url:
                raise SystemExit(f"{name}: no image url in {json.dumps(status)[:400]}")
            out_path = os.path.join(KIT_DIR, "renders", f"{name}.png")
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            urllib.request.urlretrieve(image_url, out_path)
            print("saved", out_path)
            return out_path
        if state in ("failed", "error", "cancelled"):
            raise SystemExit(f"{name}: generation {state}: {json.dumps(status)[:300]}")
    raise SystemExit(f"{name}: timed out polling")


if __name__ == "__main__":
    failed = []
    for target in (sys.argv[1:] or ["sam"]):
        try:
            generate(target)
        except (SystemExit, Exception) as error:
            print(f"{target}: FAILED - {error}")
            failed.append(target)
    if failed:
        print("failed:", ", ".join(failed))
