import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, ArrowDown } from "lucide-react";
import { getHomepage, type Banner, type Category } from "@/lib/products";
import { ProductCard } from "@/components/site/ProductCard";
import { SkullMark } from "@/components/site/Logo";
import heroImg from "@/assets/hero-1.jpg";
import campaignImg from "@/assets/campaign.jpg";
import storyImg from "@/assets/story.jpg";
import teeImg from "@/assets/product-tee.jpg";
import hoodieImg from "@/assets/product-hoodie.jpg";
import pantsImg from "@/assets/product-pants.jpg";
import shirtImg from "@/assets/product-shirt.jpg";

const homeOptions = queryOptions({
  queryKey: ["homepage"],
  queryFn: () => getHomepage(),
});

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(homeOptions);
  },
  component: Home,
  errorComponent: ({ error }) => <div className="pt-40 text-center text-sm">{error.message}</div>,
});

// Fallback images for categories that have no image yet.
const CATEGORY_IMAGES: Record<string, string> = {
  "oversized-tees": teeImg,
  shirts: shirtImg,
  hoodies: hoodieImg,
  bottomwear: pantsImg,
};

function Home() {
  const { data: home } = useSuspenseQuery(homeOptions);
  return (
    <div>
      <Hero banner={home.hero_banners[0]} />
      <Marquee />
      <FeaturedCollection products={home.featured} />
      <BrandStory />
      <Categories categories={home.categories} />
      <BestSellers products={home.best_sellers.length ? home.best_sellers : home.new_arrivals} />
      <Lookbook />
      <Campaign banner={home.campaign_banners[0]} />
      <Newsletter />
    </div>
  );
}

/** Splits "Cut Heavy. Built to Last." into an animated lead + dimmed rest. */
function splitTitle(title: string): [string, string] {
  const idx = title.indexOf(".");
  if (idx === -1 || idx === title.length - 1) return [title, ""];
  return [title.slice(0, idx + 1), title.slice(idx + 1).trim()];
}

function Hero({ banner }: { banner?: Banner }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const [lead, rest] = splitTitle(banner?.title ?? "Cut Heavy. Built to Last.");
  const eyebrow = banner?.eyebrow ?? "Chapter One — SS26";
  const image = banner?.image_url || heroImg;
  const ctaText = banner?.cta_text || "Shop Collection";
  const ctaLink = banner?.cta_link || "/shop";

  return (
    <section ref={ref} className="relative h-[100svh] min-h-[720px] w-full overflow-hidden bg-ink">
      <motion.div style={{ y }} className="absolute inset-0">
        <img
          src={image}
          alt=""
          className="h-full w-full object-cover opacity-70 animate-ken-burns"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-transparent to-ink" />
      </motion.div>

      <motion.div
        style={{ opacity }}
        className="relative z-10 mx-auto flex h-full max-w-[100rem] flex-col justify-end px-5 pb-16 md:px-10 md:pb-24"
      >
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="text-eyebrow mb-6"
        >
          {eyebrow}
        </motion.p>

        <h1 className="text-massive max-w-[14ch]">
          {lead.split("").map((c, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 + i * 0.03, ease: [0.7, 0, 0.2, 1] }}
              className="inline-block"
            >
              {c === " " ? " " : c}
            </motion.span>
          ))}
          {rest && (
            <>
              <br />
              <span className="opacity-40">{rest}</span>
            </>
          )}
        </h1>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1 }}
          className="mt-12 flex flex-wrap items-center gap-4"
        >
          <Link to={ctaLink} className="btn-cult">
            {ctaText} <ArrowRight className="h-3 w-3" />
          </Link>
          <Link to="/shop" search={{ filter: "new" } as any} className="btn-ghost">Explore</Link>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 text-muted-foreground"
      >
        <span className="text-[10px] tracking-[0.4em] uppercase">Scroll</span>
        <ArrowDown className="h-4 w-4 animate-bounce" />
      </motion.div>
    </section>
  );
}

function Marquee() {
  const words = ["Timeless", "Minimal", "Bold", "Authentic", "Cult"];
  const line = [...words, ...words, ...words, ...words];
  return (
    <section className="border-y border-hairline py-8 overflow-hidden bg-ink">
      <div className="flex marquee-track whitespace-nowrap">
        {[...line, ...line].map((w, i) => (
          <span key={i} className="mx-8 inline-flex items-center gap-8 text-large-display text-[2rem] md:text-[3rem] opacity-90">
            {w}
            <SkullMark className="h-6 w-8 text-bone/70" />
          </span>
        ))}
      </div>
    </section>
  );
}

function FeaturedCollection({ products }: { products: import("@/lib/products").ProductListItem[] }) {
  return (
    <section className="px-5 md:px-10 py-24 md:py-40">
      <SectionHead eyebrow="Featured" title="The Chapter" href="/shop" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-16 mt-16">
        {products.slice(0, 4).map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}
      </div>
    </section>
  );
}

function BrandStory() {
  return (
    <section className="grid md:grid-cols-2 min-h-[80vh] border-t border-hairline">
      <div className="relative overflow-hidden bg-secondary">
        <motion.img
          src={storyImg}
          alt="Craft"
          loading="lazy"
          initial={{ scale: 1.15 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 2, ease: [0.7, 0, 0.2, 1] }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      <div className="flex flex-col justify-center px-6 md:px-16 py-20 md:py-28 border-l border-hairline">
        <p className="text-eyebrow mb-6">The House</p>
        <h2 className="text-large-display max-w-[16ch]">
          We don&rsquo;t follow trends. We build classics.
        </h2>
        <p className="mt-8 max-w-md text-muted-foreground leading-relaxed">
          Cut &amp; Cult was born from a refusal. A refusal of noise, seasons, and
          shortcuts. Each piece is drafted from heavyweight fabric, cut to a boxed
          silhouette, and made to soften with the years — not fall apart in them.
        </p>
        <div className="mt-10 grid grid-cols-4 gap-4 text-eyebrow text-bone/80 max-w-md">
          <span>Timeless</span><span>Minimal</span><span>Bold</span><span>Cult</span>
        </div>
        <Link to="/about" className="mt-12 btn-ghost self-start">Our story</Link>
      </div>
    </section>
  );
}

function Categories({ categories }: { categories: Category[] }) {
  const items = categories.filter((c) => CATEGORY_IMAGES[c.slug] || c.image).slice(0, 4);
  return (
    <section className="px-5 md:px-10 py-24 md:py-40">
      <SectionHead eyebrow="Shop by" title="Category" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16">
        {items.map((c, i) => (
          <motion.div
            key={c.slug}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.9, ease: [0.7, 0, 0.2, 1], delay: i * 0.08 }}
          >
            <Link
              to="/shop"
              search={{ category: c.slug } as any}
              className="group relative block overflow-hidden aspect-[3/4] bg-secondary"
            >
              <img
                src={c.image || CATEGORY_IMAGES[c.slug]}
                alt={c.name}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover opacity-80 transition-transform duration-[1400ms] ease-[cubic-bezier(0.7,0,0.2,1)] group-hover:scale-110 group-hover:opacity-100"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent" />
              <div className="absolute inset-0 flex items-end p-6">
                <div>
                  <div className="text-eyebrow opacity-70">Category</div>
                  <div className="mt-2 text-large-display text-[1.4rem] md:text-[2rem]">{c.name}</div>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function BestSellers({ products }: { products: import("@/lib/products").ProductListItem[] }) {
  return (
    <section className="border-t border-hairline py-24 md:py-40">
      <div className="px-5 md:px-10">
        <SectionHead eyebrow="Cult Favourites" title="Best Sellers" href="/shop" />
      </div>
      <div className="mt-16 flex gap-6 overflow-x-auto no-scrollbar px-5 md:px-10 pb-4 snap-x">
        {products.map((p, i) => (
          <div key={p.id} className="w-[70vw] sm:w-[42vw] lg:w-[24vw] shrink-0 snap-start">
            <ProductCard p={p} index={i} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Lookbook() {
  const shots = [
    { src: hoodieImg, tall: true },
    { src: teeImg },
    { src: pantsImg },
    { src: shirtImg, tall: true },
  ];
  return (
    <section className="px-5 md:px-10 py-24 md:py-40 border-t border-hairline">
      <SectionHead eyebrow="Editorial" title="Lookbook" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16">
        {shots.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1, delay: i * 0.1, ease: [0.7, 0, 0.2, 1] }}
            className={`${s.tall ? "md:row-span-2 md:aspect-[3/5]" : "aspect-[3/4]"} relative overflow-hidden bg-secondary group`}
          >
            <img
              src={s.src}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1600ms] ease-[cubic-bezier(0.7,0,0.2,1)] group-hover:scale-105"
            />
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Campaign({ banner }: { banner?: Banner }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);
  return (
    <section ref={ref} className="relative h-[90vh] min-h-[600px] overflow-hidden">
      <motion.img
        style={{ y }}
        src={banner?.image_url || campaignImg}
        alt="Campaign"
        loading="lazy"
        className="absolute inset-0 h-[120%] w-full object-cover opacity-70"
      />
      <div className="absolute inset-0 bg-ink/40" />
      <div className="relative z-10 h-full mx-auto max-w-[100rem] px-5 md:px-10 flex flex-col justify-center">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9 }}
          className="text-eyebrow"
        >
          {banner?.eyebrow || "Campaign 001"}
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, ease: [0.7, 0, 0.2, 1] }}
          className="text-massive mt-6 max-w-[12ch]"
        >
          {banner?.title || "Enter the Cult."}
        </motion.h2>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.6 }}
          className="mt-10"
        >
          <Link to={banner?.cta_link || "/shop"} className="btn-cult">
            {banner?.cta_text || "Shop the campaign"} <ArrowRight className="h-3 w-3" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

function Newsletter() {
  return (
    <section className="border-t border-hairline px-5 md:px-10 py-24 md:py-32">
      <div className="mx-auto max-w-3xl text-center">
        <SkullMark className="mx-auto h-10 w-14 text-bone opacity-80 mb-8" />
        <p className="text-eyebrow">Members only</p>
        <h2 className="mt-6 text-large-display text-[2.5rem] md:text-[4rem]">Join the Cult</h2>
        <p className="mt-6 text-muted-foreground max-w-md mx-auto">
          Early access to drops. Private editions. No noise, ever.
        </p>
        <form onSubmit={(e) => e.preventDefault()} className="mt-10 flex items-center gap-0 border-b border-bone/40 max-w-md mx-auto">
          <input
            type="email"
            required
            placeholder="your@email.com"
            className="flex-1 bg-transparent py-4 text-sm outline-none placeholder:text-muted-foreground/60 text-center md:text-left"
          />
          <button className="text-eyebrow py-4 px-2 hover:text-bone/70">Enter</button>
        </form>
      </div>
    </section>
  );
}

function SectionHead({ eyebrow, title, href }: { eyebrow: string; title: string; href?: string }) {
  return (
    <div className="flex items-end justify-between gap-6 flex-wrap">
      <div>
        <p className="text-eyebrow">{eyebrow}</p>
        <h2 className="mt-4 text-large-display">{title}</h2>
      </div>
      {href && (
        <Link to={href} className="link-underline text-eyebrow self-end">View all →</Link>
      )}
    </div>
  );
}
