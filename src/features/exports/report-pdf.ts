import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { ReportDocument } from "./report-document";

// AIMS navy, as in the finance and board-pack PDFs.
const NAVY: [number, number, number] = [8, 85, 153];

type AutoTableDoc = jsPDF & { lastAutoTable?: { finalY: number } };

export function renderReportPdf(report: ReportDocument): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" }) as AutoTableDoc;
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

  const write = (text: string, size: number, style: "normal" | "bold", color: number) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(color, color, color);
    for (const line of doc.splitTextToSize(text, pageW - margin * 2) as string[]) {
      ensureSpace(size + 4);
      doc.text(line, margin, y);
      y += size + 4;
    }
  };

  // Header banner
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 72, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(report.title, margin, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(report.subtitle, margin, 52);
  y = 94;
  if (report.meta.length) write(report.meta.join("  ·  "), 9, "normal", 110);
  y += 4;

  for (const block of report.blocks) {
    if (block.kind === "heading") {
      y += 8;
      ensureSpace(30);
      write(block.text, 13, "bold", 20);
      y += 2;
    } else if (block.kind === "paragraph") {
      write(block.text, block.muted ? 9 : 10, "normal", block.muted ? 110 : 60);
      y += 4;
    } else if (block.kind === "bullets") {
      for (const item of block.items) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        const lines = doc.splitTextToSize(item, pageW - margin * 2 - 14) as string[];
        lines.forEach((line, i) => {
          ensureSpace(14);
          if (i === 0) doc.text("•", margin, y);
          doc.text(line, margin + 14, y);
          y += 14;
        });
      }
      y += 4;
    } else if (block.rows.length === 0) {
      write(block.emptyText ?? "Nothing to show.", 10, "normal", 110);
      y += 4;
    } else {
      const numeric = new Set(block.numeric ?? []);
      autoTable(doc, {
        startY: y,
        head: [block.columns],
        body: block.rows,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 5, textColor: 40 },
        headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: Object.fromEntries(
          [...numeric].map((i) => [i, { halign: "right" as const }]),
        ),
        didParseCell: (data) => {
          if (data.section === "head" && numeric.has(data.column.index)) {
            data.cell.styles.halign = "right";
          }
        },
      });
      y = (doc.lastAutoTable?.finalY ?? y) + 14;
    }
  }

  // Page numbers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`${report.title} · Page ${i} of ${pages}`, margin, pageH - 20);
  }

  return doc.output("blob");
}
