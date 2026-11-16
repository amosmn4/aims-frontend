export type ReportBlock =
  | {
      kind: "heading";
      text: string;
    }
  | {
      kind: "paragraph";
      text: string;
      muted?: boolean | undefined;
    }
  | {
      kind: "bullets";
      items: string[];
    }
  | {
      kind: "table";
      columns: string[];
      rows: string[][];
      numeric?: number[] | undefined;
      emptyText?: string | undefined;
    };
export interface ReportDocument {
  title: string;
  subtitle: string;
  meta: string[];
  blocks: ReportBlock[];
  fileName: string;
}
export type ReportFormat = "pdf" | "docx";
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function slugForFile(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
export async function downloadReport(report: ReportDocument, format: ReportFormat) {
  if (format === "pdf") {
    const { renderReportPdf } = await import("./report-pdf");
    saveBlob(renderReportPdf(report), `${report.fileName}.pdf`);
  } else {
    const { renderReportDocx } = await import("./report-docx");
    saveBlob(await renderReportDocx(report), `${report.fileName}.docx`);
  }
}
