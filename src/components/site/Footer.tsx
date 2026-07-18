import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SkullMark } from "./Logo";
import { api } from "@/lib/api";

type StoreSettings = {
  store_name: string;
  tagline: string;
  instagram_url: string;
  twitter_url: string;
  facebook_url: string;
  youtube_url: string;
};

export function Footer() {
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<StoreSettings>("/settings/"),
    staleTime: 5 * 60 * 1000,
  });

  const socials = [
    { label: "Instagram", href: settings?.instagram_url },
    { label: "Twitter", href: settings?.twitter_url },
    { label: "Facebook", href: settings?.facebook_url },
    { label: "YouTube", href: settings?.youtube_url },
  ].filter((s) => s.href);

  return (
    <footer className="border-t border-hairline bg-ink text-bone">
      <div className="mx-auto max-w-[100rem] px-5 md:px-10 pt-24 pb-10">
        <div className="grid gap-16 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <SkullMark className="h-16 w-20 text-bone mb-6" />
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              We don&rsquo;t follow trends. We build classics. Cut &amp; Cult is a unisex
              fashion house built on clean cuts, timeless design, and a culture
              that values authenticity.
            </p>
          </div>

          <FooterCol
            title="Shop"
            links={[
              { to: "/shop", label: "All", search: undefined },
              { to: "/shop", label: "New Arrivals", search: { filter: "new" } },
              { to: "/shop", label: "Best Sellers", search: { filter: "best" } },
              { to: "/about", label: "World", search: undefined },
            ]}
          />

          <FooterCol
            title="Help"
            links={[
              { to: "/page/$slug", label: "About Us", params: { slug: "about-us" } },
              { to: "/page/$slug", label: "Contact", params: { slug: "contact-us" } },
              { to: "/page/$slug", label: "Privacy", params: { slug: "privacy-policy" } },
              { to: "/page/$slug", label: "Terms", params: { slug: "terms-and-conditions" } },
            ]}
          />

          <div>
            <div className="text-eyebrow mb-5">Newsletter</div>
            <p className="text-sm text-muted-foreground mb-4">
              Enter the cult. First drops, no noise.
            </p>
            <form
              onSubmit={(e) => e.preventDefault()}
              className="flex items-center border-b border-bone/40"
            >
              <input
                type="email"
                required
                placeholder="your@email.com"
                className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/60"
              />
              <button className="text-eyebrow py-3 hover:text-bone/70">Join</button>
            </form>
          </div>
        </div>

        <div className="mt-24 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-hairline pt-8 text-xs text-muted-foreground">
          <div>© {new Date().getFullYear()} {settings?.store_name ?? "Cut & Cult"} — {settings?.tagline ?? "Building a culture. One cut at a time."}</div>
          {socials.length > 0 && (
            <div className="flex items-center gap-6 uppercase tracking-[0.28em]">
              {socials.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noreferrer" className="link-underline">
                  {s.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { to: string; label: string; search?: unknown; params?: unknown }[];
}) {
  return (
    <div>
      <div className="text-eyebrow mb-5">{title}</div>
      <ul className="space-y-3 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              to={l.to}
              search={l.search as any}
              params={l.params as any}
              className="link-underline text-bone/85 hover:text-bone"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
