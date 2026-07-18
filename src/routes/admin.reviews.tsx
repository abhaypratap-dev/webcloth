import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Star } from "lucide-react";
import { api } from "@/lib/api";
import { Btn, Chip, PageHead, Table, Td, useAdminList, useInvalidate } from "@/components/admin/kit";

export const Route = createFileRoute("/admin/reviews")({
  component: AdminReviews,
});

type Review = {
  id: number;
  product_title: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  is_approved: boolean;
  created_at: string;
};

function AdminReviews() {
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("pending");
  const path =
    filter === "all"
      ? "/reviews/admin/?page_size=100"
      : `/reviews/admin/?page_size=100&is_approved=${filter === "approved"}`;
  const { data: reviews, isLoading } = useAdminList<Review>(`reviews-${filter}`, path);
  const invalidate = useInvalidate(["reviews"]);

  async function moderate(id: number, action: "approve" | "reject") {
    await api(`/reviews/admin/${id}/${action}/`, { method: "PATCH" });
    invalidate();
  }
  async function remove(id: number) {
    if (confirm("Delete this review?")) {
      await api(`/reviews/admin/${id}/`, { method: "DELETE" });
      invalidate();
    }
  }

  return (
    <div>
      <PageHead title="Reviews" subtitle="Moderate customer reviews" />
      <div className="flex gap-2 mb-6">
        {(["pending", "approved", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`border px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] transition ${
              filter === f ? "bg-bone text-ink border-bone" : "border-hairline text-bone/70 hover:border-bone/50"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-eyebrow">Loading</div>
      ) : (
        <Table headers={["Product", "Author", "Rating", "Review", "Status", ""]}>
          {(reviews ?? []).map((r) => (
            <tr key={r.id}>
              <Td className="font-medium max-w-40 truncate">{r.product_title}</Td>
              <Td className="text-muted-foreground">{r.author}</Td>
              <Td>
                <span className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`h-3 w-3 ${n <= r.rating ? "fill-bone text-bone" : "text-muted-foreground"}`} />
                  ))}
                </span>
              </Td>
              <Td className="max-w-64">
                {r.title && <div className="font-medium">{r.title}</div>}
                <div className="text-xs text-muted-foreground line-clamp-2">{r.body}</div>
              </Td>
              <Td><Chip tone={r.is_approved ? "good" : "warn"}>{r.is_approved ? "Approved" : "Pending"}</Chip></Td>
              <Td>
                <div className="flex gap-2">
                  {!r.is_approved && <Btn variant="primary" onClick={() => moderate(r.id, "approve")}>Approve</Btn>}
                  {r.is_approved && <Btn onClick={() => moderate(r.id, "reject")}>Unpublish</Btn>}
                  <Btn variant="danger" onClick={() => remove(r.id)}>Del</Btn>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
