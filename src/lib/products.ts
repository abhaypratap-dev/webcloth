import { api, qs, type Paginated } from "./api";
import { resolveAsset } from "./assets";

export type ProductListItem = {
  id: number;
  slug: string;
  title: string;
  price: number;
  discount_price: number | null;
  discount_percent: number;
  applied_offer: string | null;
  category: string | null;
  category_name: string | null;
  brand: string | null;
  image: string;
  hover_image: string | null;
  new_arrival: boolean;
  best_seller: boolean;
  featured: boolean;
  in_stock: boolean;
  rating_avg: number | null;
  reviews_count: number;
};

export type ProductVariant = {
  id: number;
  size: string;
  color: string;
  color_hex: string;
  stock: number;
};

export type ProductDetail = ProductListItem & {
  sku: string | null;
  description: string;
  short_description: string;
  material: string;
  care_instructions: string;
  tags: string[];
  images: { id: number; url: string; alt: string | null }[];
  variants: ProductVariant[];
  sizes: string[];
  colors: { name: string; hex: string | null }[];
  total_stock: number;
};

export type Category = {
  id: number;
  name: string;
  slug: string;
  parent: number | null;
  description: string;
  image: string | null;
  is_active: boolean;
  sort_order: number;
  products_count: number;
};

export type Banner = {
  id: number;
  kind: "hero" | "promo" | "campaign";
  eyebrow: string;
  title: string;
  subtitle: string;
  cta_text: string;
  cta_link: string;
  image_url: string;
  is_active: boolean;
};

export type Homepage = {
  hero_banners: Banner[];
  promo_banners: Banner[];
  campaign_banners: Banner[];
  featured: ProductListItem[];
  new_arrivals: ProductListItem[];
  best_sellers: ProductListItem[];
  trending: ProductListItem[];
  categories: Category[];
  flash_sales: unknown[];
};

function fixProduct<T extends ProductListItem>(p: T): T {
  return {
    ...p,
    image: resolveAsset(p.image),
    hover_image: p.hover_image ? resolveAsset(p.hover_image) : null,
  };
}

export type ProductQuery = {
  category?: string;
  brand?: string;
  search?: string;
  ordering?: string;
  featured?: boolean;
  new_arrival?: boolean;
  best_seller?: boolean;
  min_price?: number;
  max_price?: number;
  size?: string;
  color?: string;
  in_stock?: boolean;
  page?: number;
  page_size?: number;
};

export async function listProducts(query: ProductQuery = {}): Promise<Paginated<ProductListItem>> {
  const data = await api<Paginated<ProductListItem>>(`/products/${qs(query)}`);
  return { ...data, results: data.results.map(fixProduct) };
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  try {
    const p = await api<ProductDetail>(`/products/${slug}/`);
    return {
      ...fixProduct(p),
      images: p.images.map((img) => ({ ...img, url: resolveAsset(img.url) })),
    };
  } catch (e: any) {
    if (e?.status === 404) return null;
    throw e;
  }
}

export async function listRelated(slug: string): Promise<ProductListItem[]> {
  const items = await api<ProductListItem[]>(`/products/${slug}/related/`);
  return items.map(fixProduct);
}

export async function listCategories(): Promise<Category[]> {
  return api<Category[]>(`/categories/`);
}

export async function getHomepage(): Promise<Homepage> {
  const home = await api<Homepage>(`/banners/homepage/`);
  return {
    ...home,
    hero_banners: home.hero_banners.map((b) => ({ ...b, image_url: resolveAsset(b.image_url) })),
    promo_banners: home.promo_banners.map((b) => ({ ...b, image_url: resolveAsset(b.image_url) })),
    campaign_banners: home.campaign_banners.map((b) => ({ ...b, image_url: resolveAsset(b.image_url) })),
    featured: home.featured.map(fixProduct),
    new_arrivals: home.new_arrivals.map(fixProduct),
    best_sellers: home.best_sellers.map(fixProduct),
    trending: home.trending.map(fixProduct),
  };
}

export type Review = {
  id: number;
  product: number;
  product_title: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  is_approved: boolean;
  created_at: string;
};

export async function listReviews(productId: number): Promise<Review[]> {
  const data = await api<Paginated<Review>>(`/reviews/${qs({ product: productId, page_size: 20 })}`);
  return data.results;
}
