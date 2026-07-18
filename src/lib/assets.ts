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
