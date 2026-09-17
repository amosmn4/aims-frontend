import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { InboxItem } from "./use-department-reports";

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
  reports: InboxItem[];
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
    const own = reports.filter((r) => r.department.code === dept.code);
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
      doc.setTextColor(170, 90, 20);
      doc.text("No approved report for this month.", margin, (y += 14));
      doc.setTextColor(20);
      y += 16;
      continue;
    }
    for (const r of own) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(r.title, margin, (y += 14));
      if (r.figures.length) {
        autoTable(doc, {
          startY: y + 6,
          margin: { left: margin, right: margin },
          head: [["Figure", "Value"]],
          body: r.figures.map((f) => [f.label, f.value]),
          styles: { fontSize: 9, cellPadding: 4 },
          headStyles: { fillColor: [8, 85, 153] },
          columnStyles: { 1: { halign: "right" } },
        });
        y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
      }
      if (r.summary) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(r.summary, width - margin * 2) as string[];
        for (const line of lines) {
          if (y > 780) {
            doc.addPage();
            y = 64;
          }
          doc.text(line, margin, (y += 14));
        }
      }
      y += 18;
    }
  }
  doc.save(`board-pack-${monthLabel.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}
