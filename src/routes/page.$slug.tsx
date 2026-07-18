import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

type Page = {
  title: string;
  slug: string;
  body: string;
  seo_title: string;
  seo_description: string;
};

const pageQuery = (slug: string) =>
  queryOptions({
    queryKey: ["cms-page", slug],
    queryFn: async () => {
      try {
        return await api<Page>(`/cms/pages/${slug}/`);
      } catch (e: any) {
        if (e?.status === 404) throw notFound();
        throw e;
      }
    },
  });

export const Route = createFileRoute("/page/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(pageQuery(params.slug)),
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.seo_title || loaderData.title} — Cut & Cult` },
            { name: "description", content: loaderData.seo_description || loaderData.title },
          ],
        }
      : { meta: [{ title: "Page not found" }] },
  component: CmsPage,
  notFoundComponent: () => (
    <div className="pt-40 text-center">
      <p className="text-eyebrow">Not found</p>
      <h1 className="mt-4 text-large-display text-[2rem]">This page doesn&rsquo;t exist.</h1>
      <Link to="/" className="btn-cult mt-10">Return home</Link>
    </div>
  ),
  errorComponent: ({ error }) => <div className="pt-40 text-center text-sm">{error.message}</div>,
});

function CmsPage() {
  const { slug } = Route.useParams();
  const { data: page } = useSuspenseQuery(pageQuery(slug));
  return (
    <div className="pt-32 md:pt-40 pb-24 px-5 md:px-10 max-w-3xl mx-auto">
      <p className="text-eyebrow">Cut &amp; Cult</p>
      <h1 className="mt-4 text-large-display">{page.title}</h1>
      <div className="mt-12 space-y-6 text-muted-foreground leading-relaxed whitespace-pre-line">
        {page.body}
      </div>
    </div>
  );
}
