import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  INVENTORY_CATEGORY_LABELS,
  INVENTORY_CONDITION_LABELS,
  INVENTORY_STATUS_LABELS,
  type InventoryItemRow,
} from "./use-inventory";

export function exportInventoryPdf(items: InventoryItemRow[], filterSummary?: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 32;

  doc.setFillColor(8, 85, 153);
  doc.rect(0, 0, pageW, 56, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Computer Inventory", margin, 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `${filterSummary ? filterSummary + "  ·  " : ""}${items.length} item${items.length === 1 ? "" : "s"}  ·  Generated ${new Date().toLocaleString()}`,
    margin,
    42,
  );

  autoTable(doc, {
    startY: 70,
    head: [
      ["Asset tag", "Device", "Category", "Condition", "Status", "Assigned to", "Office", "Serial"],
    ],
    body: items.map((i) => [
      i.asset_tag,
      [i.device_name, [i.brand, i.model].filter(Boolean).join(" ")].filter(Boolean).join("\n"),
      INVENTORY_CATEGORY_LABELS[i.category],
      INVENTORY_CONDITION_LABELS[i.condition],
      INVENTORY_STATUS_LABELS[i.status],
      i.assigned_to ?? "—",
      i.office_name ?? "—",
      i.serial_number ?? "—",
    ]),
    styles: { fontSize: 8.5, cellPadding: 5 },
    headStyles: { fillColor: [8, 85, 153], textColor: 255 },
    margin: { left: margin, right: margin },
    theme: "grid",
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`Computer Inventory  ·  Page ${i} of ${totalPages}`, pageW / 2, pageH - 16, {
      align: "center",
    });
  }

  doc.save(`inventory-${new Date().toISOString().slice(0, 10)}.pdf`);
}
