import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, SectionTitle, Stat } from "@/components/kit";
import { EmptyState, RecordActions } from "@/components/RecordDialog";
import { BusinessForm, FinanceForm } from "@/components/WorkspaceForms";
import type { Business, BusinessFinance } from "@/lib/data";
import {
  businessTotals,
  canSeeBusiness,
  canSeeBusinesses,
  compactKes,
  fmtKes,
  latestMonth,
  monthLabel,
  revenueByBusiness,
  rowsFor,
} from "@/lib/business";
import { useBusinessAccess } from "@/lib/access";
import { useWorkspace } from "@/lib/workspace";
import { meta } from "@/lib/meta";
import { useRole } from "@/lib/role";

export const Route = createFileRoute("/businesses")({
  head: () => ({ meta: meta("Businesses", "Monthly business finances and revenue comparisons.") }),
  component: Businesses,
});
const colors = ["var(--primary)", "var(--warning)", "var(--success)"];

function Businesses() {
  const { mode, me } = useRole();
  const { businesses, businessFinance } = useWorkspace();
  const access = useBusinessAccess();
  const [editBusiness, setEditBusiness] = useState<Business | "new" | null>(null);
  const [editFinance, setEditFinance] = useState<BusinessFinance | "new" | null>(null);
  const [businessId, setBusinessId] = useState("");
  const [month, setMonth] = useState("");
  if (!canSeeBusinesses(mode, me.id, me.dept, businesses, access))
    return (
      <Card>You do not have permission to view business finances. Ask the CEO for access.</Card>
    );
  const visible = businesses.filter((business) =>
    canSeeBusiness(business, mode, me.id, me.dept, access),
  );
  const rows = businessFinance.filter((row) =>
    visible.some((business) => business.id === row.business),
  );
  const months = [...new Set(rows.map((row) => row.month))].sort();
  const selected = month || latestMonth(rows);
  const group = businessTotals(rows.filter((row) => row.month === selected));
  const chartData = revenueByBusiness(rows, visible);
  const canEditFinance = mode === "ceo" || me.dept === "finance";
  return (
    <div>
      <PageHeader
        title="Businesses"
        subtitle="Monthly finances across Amsol and its sister businesses"
        action={
          <div className="flex flex-wrap gap-2">
            {mode === "ceo" && <Button onClick={() => setEditBusiness("new")}>Add business</Button>}
            {canEditFinance && (
              <Button
                variant="outline"
                onClick={() => {
                  setBusinessId(visible[0]?.id ?? "");
                  setEditFinance("new");
                }}
              >
                Log finances
              </Button>
            )}
          </div>
        }
      />
      <label className="field-label mb-5 max-w-xs">
        Reporting month
        <select
          className="field-input"
          value={selected}
          onChange={(event) => setMonth(event.target.value)}
        >
          {!months.length && <option value="">No finance records</option>}
          {months.map((value) => (
            <option key={value} value={value}>
              {monthLabel(value)}
            </option>
          ))}
        </select>
      </label>
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat
          label={`Revenue | ${selected ? monthLabel(selected) : "No entries"}`}
          value={compactKes(group.revenue)}
        />
        <Stat label="Expenses" value={compactKes(group.expenses)} />
        <Stat label="Profit" value={compactKes(group.profit)} />
      </div>
      <Card className="mb-8">
        <SectionTitle>Revenue comparison</SectionTitle>
        {!rows.length ? (
          <EmptyState>No monthly finance records yet.</EmptyState>
        ) : (
          <div
            className="h-72"
            role="img"
            aria-label={`Monthly revenue for ${visible.map((business) => business.name).join(", ")}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tickFormatter={compactKes}
                  width={64}
                />
                <Tooltip
                  formatter={(value: number) => fmtKes(value)}
                  contentStyle={{
                    background: "var(--popover)",
                    borderColor: "var(--border)",
                    borderRadius: 6,
                  }}
                />
                {months.map((value, index) => (
                  <Bar
                    key={value}
                    dataKey={value}
                    name={monthLabel(value)}
                    fill={colors[index % colors.length]}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((business) => {
          const monthlyRows = rowsFor(rows, business.id).filter((row) => row.month === selected);
          const totals = businessTotals(monthlyRows);
          return (
            <Card key={business.id}>
              <div className="flex justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold">{business.name}</h2>
                  <p className="text-sm text-muted-foreground">{business.sector}</p>
                </div>
                {mode === "ceo" && (
                  <RecordActions
                    collection="businesses"
                    id={business.id}
                    label={business.name}
                    onEdit={() => setEditBusiness(business)}
                  />
                )}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Revenue</p>
                  {monthlyRows.length ? compactKes(totals.revenue) : "No entry"}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Expenses</p>
                  {monthlyRows.length ? compactKes(totals.expenses) : "No entry"}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Profit</p>
                  {monthlyRows.length ? compactKes(totals.profit) : "No entry"}
                </div>
              </div>
              {canEditFinance && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setBusinessId(business.id);
                    setEditFinance("new");
                  }}
                >
                  Log finances
                </Button>
              )}
            </Card>
          );
        })}
      </div>
      <SectionTitle>Monthly history</SectionTitle>
      {!rows.length ? (
        <EmptyState>No finance history.</EmptyState>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase text-muted-foreground">
              <tr>
                {[
                  "Business",
                  "Date",
                  "Month",
                  "Revenue",
                  "Expenses",
                  "Profit",
                  "Description",
                  ...(canEditFinance ? ["Actions"] : []),
                ].map((label) => (
                  <th key={label} className="px-4 py-3">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {[...rows]
                .sort((a, b) => b.month.localeCompare(a.month))
                .map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      {visible.find((business) => business.id === row.business)?.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{row.date}</td>
                    <td className="whitespace-nowrap px-4 py-3">{monthLabel(row.month)}</td>
                    <td className="px-4 py-3">{fmtKes(row.revenue)}</td>
                    <td className="px-4 py-3">{fmtKes(row.expenses)}</td>
                    <td className="px-4 py-3">{fmtKes(row.revenue - row.expenses)}</td>
                    <td className="px-4 py-3">{row.description}</td>
                    {canEditFinance && (
                      <td className="px-4 py-3">
                        <RecordActions
                          collection="businessFinance"
                          id={row.id}
                          label={`${row.date} finances`}
                          onEdit={() => setEditFinance(row)}
                        />
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      )}
      {editBusiness && (
        <BusinessForm
          record={editBusiness === "new" ? undefined : editBusiness}
          onClose={() => setEditBusiness(null)}
        />
      )}
      {editFinance && (
        <FinanceForm
          record={editFinance === "new" ? undefined : editFinance}
          businessId={businessId}
          onClose={() => setEditFinance(null)}
        />
      )}
    </div>
  );
}
