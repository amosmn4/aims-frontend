import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Download, Loader2, Search, ShieldOff, X } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { PageHeader } from "@/components/app-shell";
import { FormField } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { formatDateTime, formatRelative } from "@/lib/format-date";
import { useAuth } from "@/lib/auth";
import { usePagination, type PaginatedResponse } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/pagination-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AuditLogRow = {
  id: string;
  userId: string | null;
  user: { id: string; fullName: string | null; email: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  area: string;
  recordName: string | null;
  summary: string;
};

type AuditFilterOptions = {
  areas: { value: string; label: string }[];
  people: { id: string; name: string }[];
};

type AuditExport = {
  limited: boolean;
  rows: { when: string; who: string; what: string; area: string; record: string }[];
};

type Filters = { userId: string; area: string; from: string; to: string; q: string };

const ALL = "all";
const EMPTY_FILTERS: Filters = { userId: "", area: "", from: "", to: "", q: "" };

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({ meta: [{ title: "Audit Log — AIMS" }, { name: "robots", content: "noindex" }] }),
  component: AuditPage,
});

function toParams(f: Filters) {
  const params = new URLSearchParams();
  if (f.userId) params.set("userId", f.userId);
  if (f.area) params.set("area", f.area);
  if (f.from) params.set("from", f.from);
  if (f.to) params.set("to", f.to);
  if (f.q.trim()) params.set("q", f.q.trim());
  return params;
}

function AuditPage() {
  const { isAdminOrCeo } = useAuth();
  const { page, pageSize, setPage, setPageSize } = usePagination(25);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [searchText, setSearchText] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (searchText === filters.q) return;
    const timer = setTimeout(() => {
      setFilters((f) => ({ ...f, q: searchText }));
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText, filters.q, setPage]);

  const dateError =
    filters.from && filters.to && filters.to < filters.from
      ? "The end date can't be before the start date."
      : "";
  const hasFilters =
    !!(filters.userId || filters.area || filters.from || filters.to) || !!searchText.trim();

  const setFilter = (key: keyof Filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearchText("");
    setPage(1);
  };

  const optionsQ = useQuery({
    queryKey: ["audit_log", "filters"],
    enabled: isAdminOrCeo,
    queryFn: () => apiJson<AuditFilterOptions>("/audit-log/filters"),
  });

  const q = useQuery({
    queryKey: ["audit_log", "list", page, pageSize, filters],
    enabled: isAdminOrCeo && !dateError,
    placeholderData: keepPreviousData,
    queryFn: () => {
      const params = toParams(filters);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      return apiJson<PaginatedResponse<AuditLogRow>>(`/audit-log?${params}`);
    },
  });
  const rows = q.data?.data ?? [];
  const total = q.data?.total ?? 0;

  const exportToExcel = async () => {
    if (dateError) return;
    setExporting(true);
    try {
      const result = await apiJson<AuditExport>(`/audit-log/export?${toParams(filters)}`);
      if (result.rows.length === 0) {
        toast.info("There's nothing to export with these filters.");
        return;
      }
      const sheet = XLSX.utils.json_to_sheet(
        result.rows.map((r) => ({
          "Date & time": new Date(r.when),
          Person: r.who,
          "What happened": r.what,
          Area: r.area,
          Record: r.record,
        })),
        { dateNF: "yyyy-mm-dd hh:mm" },
      );
      sheet["!cols"] = [{ wch: 18 }, { wch: 26 }, { wch: 60 }, { wch: 22 }, { wch: 36 }];
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Audit log");
      XLSX.writeFile(book, `audit-log-${new Date().toISOString().slice(0, 10)}.xlsx`);
      if (result.limited) {
        toast.warning(
          "Only the latest 5,000 rows were exported. Narrow the dates or filters to get older entries.",
        );
      } else {
        toast.success(`Exported ${result.rows.length.toLocaleString()} rows to Excel`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't export the audit log");
    } finally {
      setExporting(false);
    }
  };

  if (!isAdminOrCeo) {
    return (
      <div>
        <PageHeader title="Audit log" description="Who changed what across AIMS, and when." />
        <div className="rounded-lg border bg-card p-8 text-center">
          <ShieldOff className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">Only the CEO can view the audit log.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Who changed what across AIMS, and when. Filter by person, area or date, then export."
        actions={
          <Button variant="outline" onClick={exportToExcel} disabled={exporting || !!dateError}>
            {exporting ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1 h-4 w-4" />
            )}
            Export to Excel
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-start gap-3 rounded-lg border bg-card p-3">
        <FormField id="audit-person" label="Person" className="w-full sm:w-48">
          <Select
            value={filters.userId || ALL}
            onValueChange={(v) => setFilter("userId", v === ALL ? "" : v)}
          >
            <SelectTrigger id="audit-person" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Everyone</SelectItem>
              {(optionsQ.data?.people ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField id="audit-area" label="Area" className="w-full sm:w-48">
          <Select
            value={filters.area || ALL}
            onValueChange={(v) => setFilter("area", v === ALL ? "" : v)}
          >
            <SelectTrigger id="audit-area" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All areas</SelectItem>
              {(optionsQ.data?.areas ?? []).map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField id="audit-from" label="From" className="w-full sm:w-40">
          <Input
            id="audit-from"
            type="date"
            className="h-9"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => setFilter("from", e.target.value)}
          />
        </FormField>

        <FormField id="audit-to" label="To" error={dateError} className="w-full sm:w-40">
          <Input
            id="audit-to"
            type="date"
            className="h-9"
            value={filters.to}
            min={filters.from || undefined}
            aria-invalid={!!dateError}
            aria-describedby={dateError ? "audit-to-error" : undefined}
            onChange={(e) => setFilter("to", e.target.value)}
          />
        </FormField>

        <FormField id="audit-search" label="Search" className="w-full sm:w-64">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="audit-search"
              className="h-9 pl-8"
              placeholder="Search names and records"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
        </FormField>

        {hasFilters && (
          <div className="space-y-1">
            <span aria-hidden className="invisible block text-sm leading-none">
              &nbsp;
            </span>
            <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" /> Clear filters
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        {q.isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : q.isError ? (
          <LoadError
            what="the audit log"
            error={q.error}
            onRetry={() => q.refetch()}
            className="m-4"
          />
        ) : rows.length === 0 ? (
          <div className="p-8 text-center">
            {hasFilters ? (
              <>
                <p className="text-sm font-medium">No matches</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try a wider date range, another person or area, or a shorter search.
                </p>
                <Button size="sm" variant="outline" className="mt-3" onClick={clearFilters}>
                  Clear filters
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">No activity recorded yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Changes people make across AIMS will show up here as they happen.
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className={q.isFetching ? "opacity-60 transition-opacity" : undefined}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Who</TableHead>
                    <TableHead>What happened</TableHead>
                    <TableHead>Area</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          <time dateTime={row.createdAt} title={formatDateTime(row.createdAt)}>
                            {formatRelative(row.createdAt)}
                          </time>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {row.user?.fullName || row.user?.email || "AIMS"}
                        </TableCell>
                        <TableCell className="text-sm">{row.summary}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                          {row.area}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <PaginationBar
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>
    </div>
  );
}
