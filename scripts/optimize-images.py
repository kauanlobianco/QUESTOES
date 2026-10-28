"""Gera os WebP do jogo a partir do zip original do jogo físico.

Uso: npm run images  (espera "MESTRE DOS NEGÓCIOS.zip" na raiz do projeto)
"""
import io
import sys
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ZIP = ROOT / "MESTRE DOS NEGÓCIOS.zip"
OUT = ROOT / "src" / "assets"

HEROES = ["empreendedorismo", "marketing", "financas", "operacoes", "lideranca", "estrategia"]

# Fichas numeradas no físico; mapeadas pelo personagem desenhado em cada uma.
FICHAS = {
    "ficha-1": "financas",
    "ficha-2": "operacoes",
    "ficha-3": "estrategia",
    "ficha-4": "lideranca",
    "ficha-5": "empreendedorismo",
    "ficha-6": "marketing",
}

HERO_MAX = 640
FICHA_SIZE = 256
FICHA_TRIM = 0.035


def save(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "WEBP", quality=82, method=6)
    print(f"  {path.relative_to(ROOT)}  {path.stat().st_size // 1024} KB")


def main() -> int:
    if not ZIP.exists():
        print(f"Zip não encontrado: {ZIP}", file=sys.stderr)
        return 1
    with zipfile.ZipFile(ZIP) as z:
        for area in HEROES:
            img = Image.open(io.BytesIO(z.read(f"uploads/hero-{area}.png"))).convert("RGBA")
            img = img.crop(img.getbbox())
            img.thumbnail((HERO_MAX, HERO_MAX), Image.LANCZOS)
            save(img, OUT / "heroes" / f"{area}.webp")
        for name, area in FICHAS.items():
            img = Image.open(io.BytesIO(z.read(f"uploads/{name}.png"))).convert("RGBA")
            img = img.crop(img.getbbox())
            # Remove o anel branco com a linha de corte da impressão.
            w, h = img.size
            m = int(w * FICHA_TRIM)
            img = img.crop((m, m, w - m, h - m)).resize((FICHA_SIZE, FICHA_SIZE), Image.LANCZOS)
            mask = Image.new("L", (FICHA_SIZE * 4, FICHA_SIZE * 4), 0)
            ImageDraw.Draw(mask).ellipse((0, 0, FICHA_SIZE * 4 - 1, FICHA_SIZE * 4 - 1), fill=255)
            img.putalpha(mask.resize((FICHA_SIZE, FICHA_SIZE), Image.LANCZOS))
            save(img, OUT / "fichas" / f"{area}.webp")
    return 0


if __name__ == "__main__":
    sys.exit(main())
