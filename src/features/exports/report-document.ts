/**
 * A report laid out once and saved as PDF or Word. Builders describe the content;
 * report-pdf.ts and report-docx.ts draw it.
 */
export type ReportBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string; muted?: boolean }
  | { kind: "bullets"; items: string[] }
  | {
      kind: "table";
      columns: string[];
      rows: string[][];
      /** Columns (by index) holding numbers, right-aligned. */
      numeric?: number[];
      /** Shown instead of an empty table. */
      emptyText?: string;
    };

export interface ReportDocument {
  title: string;
  subtitle: string;
  /** Short lines under the title, e.g. "Prepared by …", "Generated …". */
  meta: string[];
  blocks: ReportBlock[];
  /** File name without extension. */
  fileName: string;
}

export type ReportFormat = "pdf" | "docx";

/** Saves a finished file to the person's computer. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** "water-report-september-2026" from any title. */
export function slugForFile(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Loads the renderer only when someone downloads, so neither library weighs on the page. */
export async function downloadReport(report: ReportDocument, format: ReportFormat) {
  if (format === "pdf") {
    const { renderReportPdf } = await import("./report-pdf");
    saveBlob(renderReportPdf(report), `${report.fileName}.pdf`);
  } else {
    const { renderReportDocx } = await import("./report-docx");
    saveBlob(await renderReportDocx(report), `${report.fileName}.docx`);
  }
}
