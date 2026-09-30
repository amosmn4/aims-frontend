import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { figureDelta, formatFigure, formatSystemValue, isCorrected } from "./report-format";
import type { ReportFigure } from "./use-reports";

export interface BoardPackReport {
  title: string;
  /** Null on a project report, which names a project instead. */
  department: { code: string } | null;
  /** Typed figures, or the older shape finance still sends. */
  figures: unknown;
  summary: string | null;
}

const CORRECTED_INK: [number, number, number] = [170, 90, 20];

const figuresOf = (raw: unknown): ReportFigure[] =>
  Array.isArray(raw)
    ? raw.filter((f): f is ReportFigure => !!f && typeof (f as ReportFigure).label === "string")
    : [];

/** Builds one PDF from every approved report for a month, one section per department. */
export function downloadBoardPack({
  monthLabel,
  companyName,
  departments,
  reports,
}: {
  monthLabel: string;
  companyName: string;
  departments: { code: string; name: string }[];
  reports: BoardPackReport[];
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = 64;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(`Board pack — ${monthLabel}`, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`${companyName} · built from approved department reports`, margin, (y += 18));
  doc.setTextColor(20);
  y += 20;

  for (const dept of departments) {
    const own = reports.filter((r) => r.department?.code === dept.code);
    if (y > 700) {
      doc.addPage();
      y = 64;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(dept.name, margin, (y += 12));
    y += 8;
    if (own.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(...CORRECTED_INK);
      doc.text("No approved report for this month.", margin, (y += 14));
      doc.setTextColor(20);
      y += 16;
      continue;
    }
    for (const r of own) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(r.title, margin, (y += 14));
      y = figuresTable(doc, r, y, margin);
      y = summaryText(doc, r.summary, y, margin, width);
      y += 18;
    }
  }
  doc.save(`board-pack-${monthLabel.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}

/** Every figure with the period before beside it, and corrections called out. */
function figuresTable(doc: jsPDF, report: BoardPackReport, y: number, margin: number) {
  const figures = figuresOf(report.figures);
  if (figures.length === 0) return y;

  const corrected = new Set<number>();
  const body = figures.map((f, i) => {
    let label = f.label;
    if (isCorrected(f)) {
      corrected.add(i);
      const why = f.note ? `"${f.note}"` : "no reason given";
      label = `${f.label}\nAIMS counted ${formatSystemValue(f)} — ${why}`;
    }
    const previous = formatFigure({
      value: f.previousValue ?? null,
      format: f.format,
      unit: f.unit,
    });
    const delta = figureDelta(f);
    const moved = delta && delta.direction !== "flat" ? ` (${delta.direction} ${delta.text})` : "";
    return [label, formatFigure(f), `${previous}${moved}`];
  });

  autoTable(doc, {
    startY: y + 6,
    margin: { left: margin, right: margin },
    head: [["Figure", "This period", "Period before"]],
    body,
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [8, 85, 153] },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    didParseCell: (data) => {
      if (data.section !== "body" || !corrected.has(data.row.index)) return;
      data.cell.styles.textColor = CORRECTED_INK;
      if (data.column.index === 1) data.cell.styles.fontStyle = "bold";
    },
  });
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

function summaryText(doc: jsPDF, summary: string | null, y: number, margin: number, width: number) {
  if (!summary) return y;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(20);
  const lines = doc.splitTextToSize(summary, width - margin * 2) as string[];
  let next = y;
  for (const line of lines) {
    if (next > 780) {
      doc.addPage();
      next = 64;
    }
    doc.text(line, margin, (next += 14));
  }
  return next;
}
