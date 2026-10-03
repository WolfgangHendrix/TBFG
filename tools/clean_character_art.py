"""Trim transparent padding and suppress pale matte fringe on character art."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "images"
OUTPUT = ROOT / "assets" / "clean"


def clean_image(source: Path, target: Path) -> None:
    image = Image.open(source).convert("RGBA")
    pixels = image.load()
    width, height = image.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a < 18:
                pixels[x, y] = (r, g, b, 0)
            elif a < 245:
                # Remove the white matte left by background removal at soft edges.
                opacity = a / 255
                pixels[x, y] = tuple(
                    max(0, min(255, round((channel - 255 * (1 - opacity)) / opacity)))
                    for channel in (r, g, b)
                ) + (a,)

    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if bounds:
        image = image.crop(bounds)
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, optimize=True)


def main() -> None:
    files = sorted(
        path for path in SOURCE.glob("tbfg_p*.png")
        if path.name not in {"tbfg_p1_00.png", "tbfg_p2_00.png"}
    )
    for source in files:
        clean_image(source, OUTPUT / source.name)
    print(f"Cleaned {len(files)} character images into {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
