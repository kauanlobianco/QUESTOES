"""Gera os ícones do app (PWA, favicon, iOS): a roleta com as 6 áreas + Coringa.

Uso: npm run icons  (grava em public/icons/; os PNGs ficam no repositório)
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "icons"

# Mesma ordem e cores da roleta do jogo (src/engine SLICES + src/index.css).
SLICES = ["#8b5cf6", "#ec4899", "#16a34a", "#2563eb", "#f97316", "#eab308", "#0b1220"]
BACKGROUND = "#1e293b"
GOLD = "#fbbf24"
WHITE = "#ffffff"
SCALE = 4  # desenha grande e reduz, para bordas suaves


def wheel(size: int, wheel_ratio: float, rounded: bool) -> Image.Image:
    big = size * SCALE
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, big - 1, big - 1], radius=int(big * 0.22), fill=BACKGROUND)
    else:
        d.rectangle([0, 0, big, big], fill=BACKGROUND)

    c = big / 2
    r = big * wheel_ratio / 2
    box = [c - r, c - r, c + r, c + r]
    d.ellipse([c - r * 1.04, c - r * 1.04, c + r * 1.04, c + r * 1.04], fill=WHITE)
    seg = 360 / len(SLICES)
    for i, color in enumerate(SLICES):
        # PIL mede o ângulo a partir das 3h; a roleta começa no topo, centrada na fatia.
        start = -90 + i * seg - seg / 2
        d.pieslice(box, start, start + seg, fill=color, outline=WHITE, width=max(2, int(r * 0.03)))

    hub = r * 0.2
    d.ellipse([c - hub, c - hub, c + hub, c + hub], fill=GOLD, outline=WHITE, width=max(2, int(r * 0.05)))

    # Ponteiro dourado no topo.
    tip = c - r * 0.78
    w = r * 0.16
    top = c - r * 1.1
    d.polygon([(c, tip), (c - w, top), (c + w, top)], fill=GOLD, outline=WHITE)
    return img.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    wheel(192, 0.78, rounded=False).save(OUT / "icon-192.png")
    wheel(512, 0.78, rounded=False).save(OUT / "icon-512.png")
    # Maskable: o sistema corta em círculo/gota; a arte fica na zona segura (80%).
    wheel(512, 0.6, rounded=False).save(OUT / "icon-maskable-512.png")
    wheel(180, 0.78, rounded=False).save(OUT / "apple-touch-icon.png")
    wheel(64, 0.86, rounded=True).save(OUT / "favicon-64.png")
    for f in sorted(OUT.iterdir()):
        print(f"{f.name}: {f.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
