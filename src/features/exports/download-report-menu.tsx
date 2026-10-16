import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadReport, type ReportDocument, type ReportFormat } from "./report-document";

/** "Download report" with a choice of PDF or Word. `build` returns null until data has loaded. */
export function DownloadReportMenu({
  build,
  label = "Download report",
}: {
  build: () => ReportDocument | null;
  label?: string;
}) {
  const [busy, setBusy] = useState<ReportFormat | null>(null);

  const run = async (format: ReportFormat) => {
    const report = build();
    if (!report) {
      toast.error("The report is still loading. Try again in a moment.");
      return;
    }
    setBusy(format);
    try {
      await downloadReport(report, format);
      toast.success(format === "pdf" ? "PDF downloaded" : "Word document downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create the file");
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" disabled={!!busy}>
          {busy ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-1 h-4 w-4" />
          )}
          {label}
          <ChevronDown className="ml-1 h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => run("pdf")}>
          <FileText className="mr-2 h-4 w-4" /> PDF (.pdf)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run("docx")}>
          <FileText className="mr-2 h-4 w-4" /> Word (.docx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
