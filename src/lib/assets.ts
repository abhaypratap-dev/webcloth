// Seeded catalog rows reference "/assets/*.jpg" placeholders; resolve them to
// the hashed bundle URLs. Admin-uploaded images come back as absolute URLs and
// pass through untouched.
import tee from "@/assets/product-tee.jpg";
import hoodie from "@/assets/product-hoodie.jpg";
import pants from "@/assets/product-pants.jpg";
import shirt from "@/assets/product-shirt.jpg";
import hero from "@/assets/hero-1.jpg";
import campaign from "@/assets/campaign.jpg";
import story from "@/assets/story.jpg";

const ASSET_MAP: Record<string, string> = {
  "/assets/product-tee.jpg": tee,
  "/assets/product-hoodie.jpg": hoodie,
  "/assets/product-pants.jpg": pants,
  "/assets/product-shirt.jpg": shirt,
  "/assets/hero-1.jpg": hero,
  "/assets/campaign.jpg": campaign,
  "/assets/story.jpg": story,
};

export function resolveAsset(url: string | null | undefined): string {
  if (!url) return "";
  return ASSET_MAP[url] ?? url;
}

const WIDTHS = [320, 480, 640, 960, 1280, 1600];

/** Admin uploads, which the API can resize (`?w=`); bundled assets cannot be. */
function isMedia(url: string) {
  return url.includes("/media/") && !url.includes("?");
}

/** One uploaded image at a given width — the API snaps it to a cached size. */
export function sized(url: string | null | undefined, width: number): string {
  const resolved = resolveAsset(url);
  return isMedia(resolved) ? `${resolved}?w=${width}` : resolved;
}

/**
 * `src`/`srcSet`/`sizes` for an <img>, so the browser downloads the width the
 * layout needs instead of the original upload (often a multi-MB PNG).
 * `sizes` describes how wide the image renders, e.g. "(min-width: 768px) 25vw, 50vw".
 */
export function responsive(url: string | null | undefined, sizes: string, maxWidth = 1600) {
  const resolved = resolveAsset(url);
  if (!isMedia(resolved)) return { src: resolved };
  const widths = WIDTHS.filter((w) => w <= maxWidth);
  return {
    src: `${resolved}?w=${widths[Math.min(2, widths.length - 1)]}`,
    srcSet: widths.map((w) => `${resolved}?w=${w} ${w}w`).join(", "),
    sizes,
  };
}
