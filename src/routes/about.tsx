import { createFileRoute, Link } from "@tanstack/react-router";
import storyImg from "@/assets/story.jpg";
import campaignImg from "@/assets/campaign.jpg";
import { SkullMark } from "@/components/site/Logo";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "World — Cut & Cult" },
      { name: "description", content: "The story behind Cut & Cult — a unisex fashion house built on cuts, craft, and culture." },
      { property: "og:title", content: "The World of Cut & Cult" },
      { property: "og:description", content: "Timeless silhouettes. Heavyweight fabrics. A cult of authenticity." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div>
      <section className="pt-40 pb-24 px-5 md:px-10 text-center max-w-4xl mx-auto">
        <SkullMark className="mx-auto h-12 mb-8" />
        <p className="text-eyebrow">The House</p>
        <h1 className="mt-6 text-massive text-[3.5rem] md:text-[7rem]">Cut &amp; Cult</h1>
        <p className="mt-8 text-lg text-muted-foreground max-w-xl mx-auto">
          Building a culture. One cut at a time.
        </p>
      </section>

      <section className="relative h-[70vh] overflow-hidden">
        <img src={campaignImg} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-70" />
      </section>

      <section className="grid md:grid-cols-2 border-t border-hairline">
        <div className="relative min-h-[60vh] overflow-hidden">
          <img src={storyImg} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        </div>
        <div className="px-6 md:px-16 py-20 md:py-28 border-l border-hairline">
          <p className="text-eyebrow mb-6">Manifesto</p>
          <h2 className="text-large-display max-w-[16ch]">Refusal is the first cut.</h2>
          <div className="mt-10 space-y-6 text-muted-foreground leading-relaxed max-w-md">
            <p>
              We refuse noise. We refuse trends. We refuse anything that softens
              after a season. Every piece is drafted from heavyweight cloth,
              cut to a boxed silhouette, and finished by hand.
            </p>
            <p>
              What we build is meant to outlast us. What we sell is not a look.
              It&rsquo;s a way of standing in the world.
            </p>
          </div>
          <div className="mt-14 grid grid-cols-4 gap-4 text-eyebrow max-w-md">
            <span>Timeless</span><span>Minimal</span><span>Bold</span><span>Cult</span>
          </div>
        </div>
      </section>

      <section className="px-5 md:px-10 py-32 text-center">
        <p className="text-eyebrow">Chapter One</p>
        <h2 className="mt-6 text-large-display">Enter the Cult.</h2>
        <div className="mt-10">
          <Link to="/shop" className="btn-cult">Shop the collection</Link>
        </div>
      </section>
    </div>
  );
}
