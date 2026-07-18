import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Paginated } from "@/lib/api";
import { Btn, Chip, money, PageHead, Table, Td, useInvalidate } from "@/components/admin/kit";

export const Route = createFileRoute("/admin/customers")({
  component: AdminCustomers,
});

type Customer = {
  id: number;
  full_name: string;
  email: string;
  mobile: string;
  is_active: boolean;
  is_blocked: boolean;
  is_staff: boolean;
  date_joined: string;
  orders_count: number;
  total_spent: string;
};

function AdminCustomers() {
  const [search, setSearch] = useState("");
  const invalidate = useInvalidate(["customers"]);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "customers", search],
    queryFn: () =>
      api<Paginated<Customer>>(`/auth/admin/customers/?page_size=50${search ? `&search=${encodeURIComponent(search)}` : ""}`),
  });

  async function toggleBlock(customer: Customer) {
    await api(`/auth/admin/customers/${customer.id}/${customer.is_blocked ? "unblock" : "block"}/`, {
      method: "PATCH",
    });
    invalidate();
  }

  return (
    <div>
      <PageHead title="Customers" subtitle={`${data?.count ?? 0} customers`} />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name, email, mobile…"
        className="mb-4 w-full max-w-sm bg-transparent border border-hairline focus:border-bone px-3 py-2 outline-none text-sm"
      />
      {isLoading ? (
        <div className="text-eyebrow">Loading</div>
      ) : (
        <Table headers={["Name", "Email", "Mobile", "Orders", "Spent", "Status", ""]}>
          {(data?.results ?? []).map((c) => (
            <tr key={c.id}>
              <Td className="font-medium">
                {c.full_name}
                {c.is_staff && <Chip>Staff</Chip>}
              </Td>
              <Td className="text-muted-foreground">{c.email}</Td>
              <Td className="text-muted-foreground">{c.mobile || "—"}</Td>
              <Td>{c.orders_count}</Td>
              <Td>{money(c.total_spent)}</Td>
              <Td>
                <Chip tone={c.is_blocked ? "bad" : "good"}>{c.is_blocked ? "Blocked" : "Active"}</Chip>
              </Td>
              <Td>
                {!c.is_staff && (
                  <Btn variant={c.is_blocked ? "primary" : "danger"} onClick={() => toggleBlock(c)}>
                    {c.is_blocked ? "Unblock" : "Block"}
                  </Btn>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
