import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, isDemo } from "@/lib/api";
import { Card } from "./kit";

type Counts = {
  blog: number;
  published: number;
  waterMeters: number;
  waterCustomers: number;
  tenders: number;
  inventory: number;
};
export function ModuleSummaries() {
  const query = useQuery({
    queryKey: ["ceo-module-counts"],
    queryFn: () => api<Counts>("/dashboard/modules"),
    enabled: !isDemo,
    refetchInterval: 60000,
  });
  if (isDemo) return null;
  if (query.error)
    return (
      <p role="alert" className="mb-5 text-sm">
        Module summaries could not load: {query.error.message}
      </p>
    );
  const data = query.data;
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        {
          to: "/marketing/blog" as const,
          label: "Blog",
          count: data?.blog,
          detail: `${data?.published ?? 0} published posts`,
        },
        {
          to: "/water" as const,
          label: "Water",
          count: data?.waterMeters,
          detail: `${data?.waterCustomers ?? 0} customers`,
        },
        {
          to: "/tenders" as const,
          label: "Tenders",
          count: data?.tenders,
          detail: "View the full tender pipeline",
        },
        {
          to: "/inventory" as const,
          label: "Inventory",
          count: data?.inventory,
          detail: "View company assets",
        },
      ].map((item) => (
        <Link to={item.to} key={item.label}>
          <Card>
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="my-2 text-2xl font-semibold">{item.count ?? "..."}</p>
            <p className="text-xs text-muted-foreground">{item.detail}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}
