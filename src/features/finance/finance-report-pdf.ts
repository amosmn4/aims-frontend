import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import type { FinanceReportRow, FinanceReportCommentRow } from "./use-finance-reports";
import { REPORT_TYPE_LABELS, STATUS_LABELS, type KpiEntry } from "./finance-report-snapshot";
import { formatCurrency } from "./finance";
import { formatDate, formatDateTime } from "@/lib/format-date";

function fmtKpi(k: KpiEntry, currency: string) {
  if (k.format === "currency") return formatCurrency(k.value, currency);
  if (k.format === "percent") return `${k.value.toFixed(1)}%`;
  return k.value.toLocaleString();
}

interface Author {
  id: string;
  full_name: string | null;
  email: string;
}

export async function exportFinanceReportPdf({
  report,
  comments,
  authors,
  chartElementIds,
  currency,
}: {
  /** Company currency, used when an older report has none saved. */
  currency: string;
  report: FinanceReportRow;
  comments: FinanceReportCommentRow[];
  authors: Map<string, Author>;
  chartElementIds: string[];
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const heading = (text: string, size = 13) => {
    ensureSpace(size + 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(20, 20, 20);
    doc.text(text, margin, y);
    y += size + 6;
  };
  const body = (text: string, size = 10) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(text, pageW - margin * 2);
    for (const line of lines) {
      ensureSpace(size + 4);
      doc.text(line, margin, y);
      y += size + 4;
    }
  };

  // --- Header banner ---
  doc.setFillColor(8, 85, 153);
  doc.rect(0, 0, pageW, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(report.title, margin, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `${REPORT_TYPE_LABELS[report.report_type]}  ·  ${formatDate(report.period_start)} – ${formatDate(report.period_end)}  ·  Status: ${STATUS_LABELS[report.status]}`,
    margin,
    52,
  );
  y = 90;
  const author = authors.get(report.created_by);
  const reviewer = report.reviewed_by ? authors.get(report.reviewed_by) : null;
  const metaBits = [
    author ? `Prepared by ${author.full_name ?? author.email}` : null,
    report.submitted_at ? `Submitted ${formatDate(report.submitted_at)}` : null,
    reviewer && report.reviewed_at
      ? `Reviewed by ${reviewer.full_name ?? reviewer.email} on ${formatDate(report.reviewed_at)}`
      : null,
    `Generated ${formatDateTime(new Date())}`,
  ].filter(Boolean) as string[];
  body(metaBits.join("  ·  "), 9);
  y += 6;

  // --- Narrative ---
  if (report.narrative) {
    heading("Finance commentary");
    body(report.narrative);
    y += 6;
  }

  // --- Review note ---
  if (report.review_note) {
    heading(report.status === "approved" ? "CEO approval note" : "CEO requested changes");
    body(report.review_note);
    y += 6;
  }

  const snap = report.snapshot;
  const cur = snap.currency ?? currency;
  const money = (v: number) => formatCurrency(v, cur);
  body(`Amounts in ${cur}.`, 9);

  // --- KPIs ---
  if (snap.kpis?.length) {
    heading("Key metrics");
    autoTable(doc, {
      startY: y,
      head: [["Metric", "Value"]],
      body: snap.kpis.map((k) => [k.label, fmtKpi(k, cur)]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [8, 85, 153], textColor: 255 },
      margin: { left: margin, right: margin },
      theme: "grid",
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
  }

  // --- Income vs Expenses by service line ---
  if (snap.by_service_line?.length) {
    heading("Revenue and direct cost by service line");
    const rows = snap.by_service_line.map((l) => {
      const profit = l.total - l.cost;
      const margin = l.total > 0 ? ((profit / l.total) * 100).toFixed(1) + "%" : "—";
      return [
        l.name,
        l.recurring ? "Recurring" : "One-off",
        money(l.total),
        money(l.cost),
        money(profit),
        margin,
      ];
    });
    const totIncome = snap.by_service_line.reduce((s, l) => s + l.total, 0);
    const totCost = snap.by_service_line.reduce((s, l) => s + l.cost, 0);
    autoTable(doc, {
      startY: y,
      head: [["Service line", "Type", "Revenue", "Direct cost", "Profit", "Margin"]],
      body: rows,
      foot: [
        [
          "TOTAL",
          "",
          money(totIncome),
          money(totCost),
          money(totIncome - totCost),
          totIncome > 0 ? `${(((totIncome - totCost) / totIncome) * 100).toFixed(1)}%` : "—",
        ],
      ],
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [8, 85, 153], textColor: 255 },
      footStyles: { fillColor: [235, 240, 245], textColor: 20, fontStyle: "bold" },
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
      },
      margin: { left: margin, right: margin },
      theme: "grid",
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
  }

  // --- Income by client (using top debtors as client-level income snapshot) ---
  if (snap.top_debtors?.length) {
    heading("What clients still owe");
    autoTable(doc, {
      startY: y,
      head: [["Client", "Still owed", "Most days late"]],
      body: snap.top_debtors.map((d) => [d.client, money(d.outstanding), `${d.oldest_days}d`]),
      foot: [["TOTAL", money(snap.top_debtors.reduce((s, d) => s + d.outstanding, 0)), ""]],
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [8, 85, 153], textColor: 255 },
      footStyles: { fillColor: [235, 240, 245], textColor: 20, fontStyle: "bold" },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
      margin: { left: margin, right: margin },
      theme: "grid",
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
  }

  // --- Monthly P&L table ---
  if (snap.monthly?.length) {
    heading("Profit and loss by month");
    autoTable(doc, {
      startY: y,
      head: [["Month", "Revenue", "Cost", "Profit"]],
      body: snap.monthly.map((m) => [m.label, money(m.revenue), money(m.cost), money(m.profit)]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [8, 85, 153], textColor: 255 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      margin: { left: margin, right: margin },
      theme: "grid",
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
  }

  // --- Ageing table ---
  if (snap.aging?.length) {
    heading("Money owed to us, by days late");
    autoTable(doc, {
      startY: y,
      head: [["How late", "Amount", "Invoices"]],
      body: snap.aging.map((a) => [a.label, money(a.amount), String(a.count)]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [8, 85, 153], textColor: 255 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
      margin: { left: margin, right: margin },
      theme: "grid",
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
  }

  // --- Charts (screenshotted from DOM) ---
  const chartEls = chartElementIds
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => !!el);

  if (chartEls.length) {
    doc.addPage();
    y = margin;
    heading("Charts", 14);
    for (const el of chartEls) {
      const canvas = await html2canvas(el, {
        backgroundColor: "#ffffff",
        scale: 2,
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const maxW = pageW - margin * 2;
      const ratio = canvas.height / canvas.width;
      const w = maxW;
      const h = w * ratio;
      ensureSpace(h + 20);
      doc.addImage(imgData, "PNG", margin, y, w, h);
      y += h + 16;
    }
  }

  // --- Comments ---
  if (comments.length) {
    ensureSpace(60);
    heading(`Discussion (${comments.length})`);
    for (const c of comments) {
      const p = authors.get(c.author_id);
      const who = p?.full_name ?? p?.email ?? "User";
      const when = formatDateTime(c.created_at);
      ensureSpace(40);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 20);
      doc.text(`${who}`, margin, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`  ${when}`, margin + doc.getTextWidth(who), y);
      y += 14;
      body(c.body, 10);
      y += 6;
    }
  }

  // --- Footer with page numbers ---
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`${report.title}  ·  Page ${i} of ${total}`, pageW / 2, pageH - 20, {
      align: "center",
    });
  }

  const safe = report.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`${safe}-${report.period_end}.pdf`);
}
