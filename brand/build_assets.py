"""Regenerate every derived brand asset in public/ from brand/logo-master.png.

Run from the repo root with any Python that has Pillow available:

    backend/.venv/bin/python brand/build_assets.py

The master is white/grey artwork composited on an opaque black plate. The site
background is #111111, so pasting the master straight into the page would show
a visible black rectangle — everything below keys that plate out to alpha.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT / "brand" / "logo-master.png"
PUBLIC = ROOT / "public"

INK = (17, 17, 17, 255)  # --ink, the site background

# Crops into the master (left, upper, right, lower), measured off its artwork.
LOCKUP_BOX = (383, 293, 1196, 594)   # skull + wordmark
MARK_BOX = (497, 288, 818, 452)      # skull alone, above the wordmark's cap line


def black_matte_to_alpha(rgb_image: Image.Image) -> Image.Image:
    """Convert artwork-on-black into artwork-on-transparent.

    Luminance is treated as coverage and the colour un-premultiplied, which
    reproduces the master exactly over black while giving correctly
    antialiased edges over any other background. A plain colour-key would
    leave jagged edges and a dark fringe.
    """
    width, height = rgb_image.size
    src = rgb_image.load()
    out = Image.new("RGBA", (width, height))
    dst = out.load()
    for y in range(height):
        for x in range(width):
            r, g, b = src[x, y]
            alpha = max(r, g, b)
            if alpha == 0:
                dst[x, y] = (0, 0, 0, 0)
            else:
                scale = 255 / alpha
                dst[x, y] = (
                    min(255, int(r * scale)),
                    min(255, int(g * scale)),
                    min(255, int(b * scale)),
                    alpha,
                )
    return out


def transparent_crop(box, target_width: int, pad: float = 0.04) -> Image.Image:
    art = black_matte_to_alpha(Image.open(MASTER).convert("RGB").crop(box))
    if pad:
        pad_x, pad_y = int(art.width * pad), int(art.height * pad)
        canvas = Image.new("RGBA", (art.width + 2 * pad_x, art.height + 2 * pad_y), (0, 0, 0, 0))
        canvas.paste(art, (pad_x, pad_y))
        art = canvas
    ratio = target_width / art.width
    return art.resize((target_width, max(1, round(art.height * ratio))), Image.LANCZOS)


def on_ink(art: Image.Image, size, coverage: float = 0.72) -> Image.Image:
    """Center `art` on an ink plate — for icons, which need their own ground."""
    width, height = size
    canvas = Image.new("RGBA", size, INK)
    ratio = min(width * coverage / art.width, height * coverage / art.height)
    art = art.resize((max(1, round(art.width * ratio)), max(1, round(art.height * ratio))), Image.LANCZOS)
    canvas.alpha_composite(art, ((width - art.width) // 2, (height - art.height) // 2))
    return canvas


def main() -> None:
    lockup = transparent_crop(LOCKUP_BOX, 900)
    lockup.save(PUBLIC / "logo.png", optimize=True)

    mark = transparent_crop(MARK_BOX, 320)
    mark.save(PUBLIC / "logo-mark.png", optimize=True)

    # White-on-transparent disappears against light browser chrome, so the
    # icons get the brand's own ink plate behind them.
    on_ink(mark, (256, 256), 0.80).save(
        PUBLIC / "favicon.ico",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    on_ink(mark, (180, 180), 0.76).convert("RGB").save(PUBLIC / "apple-touch-icon.png", optimize=True)
    on_ink(lockup, (1200, 630), 0.68).convert("RGB").save(PUBLIC / "og-image.png", optimize=True)

    for name in ("logo.png", "logo-mark.png", "favicon.ico", "apple-touch-icon.png", "og-image.png"):
        print(f"  public/{name}")


if __name__ == "__main__":
    main()
