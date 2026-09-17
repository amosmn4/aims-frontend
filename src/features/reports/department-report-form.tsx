import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Save, Send, Sparkles, Trash2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { FormField, RequiredNote } from "@/components/form-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PERIOD_TYPE_LABEL,
  fetchSuggestedFigures,
  useCreateDepartmentReport,
  useUpdateDepartmentReport,
  type DepartmentReportDetail,
  type ReportFigure,
  type ReportPeriodType,
} from "./use-department-reports";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function lastMonth() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return {
    start: iso(start),
    end: iso(end),
    label: start.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
  };
}

type Errors = Partial<Record<"title" | "periodStart" | "periodEnd" | "figures", string>>;

/** Create or edit a department report, then save it as a draft or send it to the CEO. */
export function DepartmentReportForm({
  department,
  report,
  onClose,
}: {
  department: { id: string; name: string };
  report?: DepartmentReportDetail;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const canSubmit = useAuth().hasCapability("submit_reports");
  const create = useCreateDepartmentReport();
  const update = useUpdateDepartmentReport();
  const [initial] = useState(() => {
    const period = lastMonth();
    return {
      title: report?.title ?? `${department.name} monthly report — ${period.label}`,
      periodType: (report?.periodType ?? "monthly") as ReportPeriodType,
      periodStart: report?.periodStart.slice(0, 10) ?? period.start,
      periodEnd: report?.periodEnd.slice(0, 10) ?? period.end,
      summary: report?.summary ?? "",
      figures: JSON.stringify(report?.figures ?? []),
    };
  });
  const [title, setTitle] = useState(initial.title);
  const [periodType, setPeriodType] = useState<ReportPeriodType>(initial.periodType);
  const [periodStart, setPeriodStart] = useState(initial.periodStart);
  const [periodEnd, setPeriodEnd] = useState(initial.periodEnd);
  const [summary, setSummary] = useState(initial.summary);
  const [figures, setFigures] = useState<ReportFigure[]>(report?.figures ?? []);
  const [note, setNote] = useState("");
  const [filling, setFilling] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const resubmitting = report?.status === "changes_requested";
  const busy = create.isPending || update.isPending;

  const dirty =
    title !== initial.title ||
    periodType !== initial.periodType ||
    periodStart !== initial.periodStart ||
    periodEnd !== initial.periodEnd ||
    summary !== initial.summary ||
    JSON.stringify(figures) !== initial.figures ||
    note.trim() !== "";
  const { guardClose } = useUnsavedChanges(dirty);

  const clearError = (key: keyof Errors) => setErrors((e) => ({ ...e, [key]: undefined }));

  const fill = async () => {
    setFilling(true);
    try {
      const suggested = await fetchSuggestedFigures(department.id, periodStart, periodEnd);
      setFigures((current) => {
        const kept = current.filter(
          (f) => f.label.trim() && !suggested.some((s) => s.label === f.label),
        );
        return [...suggested, ...kept];
      });
      clearError("figures");
      toast.success("Figures filled in from AIMS. Check them before you send the report.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't fill in the figures");
    } finally {
      setFilling(false);
    }
  };

  const validate = () => {
    const next: Errors = {};
    if (title.trim().length < 3) next.title = "Give the report a title.";
    if (!periodStart) next.periodStart = "Choose when the period starts.";
    if (!periodEnd) next.periodEnd = "Choose when the period ends.";
    if (periodStart && periodEnd && periodEnd < periodStart)
      next.periodEnd = "The period must end after it starts.";
    const cleaned = figures.filter((f) => f.label.trim() || f.value.trim());
    if (cleaned.some((f) => !f.label.trim() || !f.value.trim()))
      next.figures = "Every figure needs a name and a value.";
    setErrors(next);
    return Object.keys(next).length === 0 ? cleaned : null;
  };

  const save = async (submit: boolean) => {
    const cleaned = validate();
    if (!cleaned) return;
    const input = {
      title: title.trim(),
      periodType,
      periodStart,
      periodEnd,
      summary,
      figures: cleaned.map((f) => ({ label: f.label.trim(), value: f.value.trim() })),
      submit,
      note: note.trim() || undefined,
    };
    try {
      if (report) {
        await update.mutateAsync({ id: report.id, ...input });
        toast.success(
          submit
            ? resubmitting
              ? "Report sent back to the CEO"
              : "Report sent to the CEO"
            : "Report saved",
        );
        onClose();
      } else {
        const created = await create.mutateAsync({ departmentId: department.id, ...input });
        toast.success(submit ? "Report sent to the CEO" : "Draft saved");
        onClose();
        navigate({ to: "/department-reports/$reportId", params: { reportId: created.id } });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the report");
    }
  };

  const setFigure = (index: number, key: keyof ReportFigure, value: string) => {
    setFigures((rows) => rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
    clearError("figures");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && guardClose(onClose)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {report
              ? resubmitting
                ? "Update and resubmit report"
                : "Edit report"
              : "New report for the CEO"}
          </DialogTitle>
          <DialogDescription>
            {department.name} · Fill in the figures, add a short summary, then send it to the CEO.
            You can save a draft and finish later.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <RequiredNote />
          <FormField id="rep-title" label="Report title" required error={errors.title}>
            <Input
              id="rep-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                clearError("title");
              }}
              aria-invalid={!!errors.title}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField id="rep-type" label="Period">
              <Select
                value={periodType}
                onValueChange={(v) => setPeriodType(v as ReportPeriodType)}
              >
                <SelectTrigger id="rep-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PERIOD_TYPE_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="rep-start" label="From" required error={errors.periodStart}>
              <Input
                id="rep-start"
                type="date"
                value={periodStart}
                aria-invalid={!!errors.periodStart}
                onChange={(e) => {
                  setPeriodStart(e.target.value);
                  clearError("periodStart");
                }}
              />
            </FormField>
            <FormField id="rep-end" label="To" required error={errors.periodEnd}>
              <Input
                id="rep-end"
                type="date"
                value={periodEnd}
                min={periodStart || undefined}
                aria-invalid={!!errors.periodEnd}
                onChange={(e) => {
                  setPeriodEnd(e.target.value);
                  clearError("periodEnd");
                }}
              />
            </FormField>
          </div>

          <fieldset className="grid gap-2 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Key figures</legend>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                AIMS can fill these in from what your department recorded for this period.
              </p>
              <Button type="button" size="sm" variant="outline" onClick={fill} disabled={filling}>
                {filling ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-4 w-4" />
                )}
                Fill figures from AIMS
              </Button>
            </div>
            {figures.length === 0 && (
              <p className="rounded-md bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
                No figures yet. Use “Fill figures from AIMS” or add your own.
              </p>
            )}
            {figures.map((f, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_6rem_auto] items-center gap-2 sm:grid-cols-[1fr_10rem_auto]"
              >
                <Input
                  aria-label={`Figure ${i + 1} name`}
                  placeholder="e.g. People placed"
                  value={f.label}
                  onChange={(e) => setFigure(i, "label", e.target.value)}
                />
                <Input
                  aria-label={`Figure ${i + 1} value`}
                  placeholder="e.g. 11"
                  value={f.value}
                  onChange={(e) => setFigure(i, "value", e.target.value)}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove figure ${f.label || i + 1}`}
                  onClick={() => setFigures((rows) => rows.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {errors.figures && (
              <p role="alert" className="text-xs text-destructive">
                {errors.figures}
              </p>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="justify-self-start"
              onClick={() => setFigures((rows) => [...rows, { label: "", value: "" }])}
              disabled={figures.length >= 24}
            >
              <Plus className="mr-1 h-4 w-4" /> Add a figure
            </Button>
          </fieldset>

          <FormField id="rep-summary" label="Summary for the CEO">
            <Textarea
              id="rep-summary"
              rows={5}
              placeholder="What happened this period, what went well, what needs attention."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </FormField>

          <FormField id="rep-note" label="Message with this report">
            <Input
              id="rep-note"
              placeholder={
                resubmitting
                  ? "e.g. Added the client breakdown you asked for"
                  : "e.g. Collections will improve next month"
              }
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </FormField>

          <p className="text-xs text-muted-foreground">
            After saving, you can attach files (PDF, Excel) on the report page.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {!canSubmit && (
            <p className="mr-auto self-center text-xs text-muted-foreground">
              Your role can't send reports to the CEO. Ask the CEO if you need to.
            </p>
          )}
          <Button variant="outline" onClick={() => guardClose(onClose)} disabled={busy}>
            Cancel
          </Button>
          {canSubmit && (
            <>
              <Button variant="outline" onClick={() => save(false)} disabled={busy}>
                <Save className="mr-1 h-4 w-4" />
                {report ? "Save report" : "Save as draft"}
              </Button>
              <Button onClick={() => save(true)} disabled={busy}>
                {busy ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1 h-4 w-4" />
                )}
                {resubmitting ? "Resubmit to CEO" : "Submit to CEO"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
