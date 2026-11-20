import type { ReactNode } from "react";
import AssignmentOutlined from "@mui/icons-material/AssignmentOutlined";

export function ReportingHeader({
  title,
  eyebrow,
  subtitle,
  action,
}: {
  title: string;
  eyebrow: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="pagehead">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p className="sub">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
export function ReportingPanel({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      {title && (
        <div className="panelhead">
          <h3>{title}</h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function ReportingTag({ children, status = "" }: { children: ReactNode; status?: string }) {
  const tone = /return|blocked|recalled/i.test(status)
    ? "red"
    : /draft|pending|schedule|attention|progress|not submitted/i.test(status)
      ? "amber"
      : /reviewed|completed|submitted/i.test(status)
        ? "green"
        : "blue";
  return <span className={`tag ${tone}`}>{children}</span>;
}
export function ReportingStats({
  items,
}: {
  items: { label: string; value: ReactNode; note: string; icon?: ReactNode }[];
}) {
  return (
    <div className="stats">
      {items.map((item) => (
        <div className="stat" key={item.label}>
          <div className="statline">
            {item.label}
            <span className="staticon">
              {item.icon ?? <AssignmentOutlined fontSize="inherit" />}
            </span>
          </div>
          <div className={`statnum ${typeof item.value === "string" ? "stattext" : ""}`}>
            {item.value}
          </div>
          <div className="statnote">{item.note}</div>
        </div>
      ))}
    </div>
  );
}
export function ReportingPagination({
  page,
  total,
  limit = 10,
  onPage,
}: {
  page: number;
  total: number;
  limit?: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <nav aria-label="Pagination" className="report-pagination">
      <span>
        {total
          ? `${(page - 1) * limit + 1} to ${Math.min(page * limit, total)} of ${total}`
          : "0 results"}
      </span>
      <div>
        <button className="btn secondary sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button
          className="btn secondary sm"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
