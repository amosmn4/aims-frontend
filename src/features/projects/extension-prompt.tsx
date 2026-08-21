import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EXTENSION_ATTRIBUTION_LABELS,
  type ExtensionAttribution,
} from "@/features/projects/use-projects";

// Shown inline on a project/task edit form whenever the date field is pushed later than its
// current value — encourages recording why, without hard-blocking the save (the backend accepts
// the update either way; this is rigor, not a workflow gate). Shared between EditProjectDialog
// (endDate) and EditTaskForm (dueDate).
export function isExtension(previousDate: string | null | undefined, newDate: string): boolean {
  if (!previousDate || !newDate) return false;
  return new Date(newDate).getTime() > new Date(previousDate).getTime();
}

export function ExtensionPrompt({
  reason,
  onReasonChange,
  attribution,
  onAttributionChange,
}: {
  reason: string;
  onReasonChange: (v: string) => void;
  attribution: ExtensionAttribution;
  onAttributionChange: (v: ExtensionAttribution) => void;
}) {
  return (
    <div className="rounded-md border border-warning/30 bg-warning/5 p-3 space-y-2">
      <div className="text-xs font-medium text-warning">
        This pushes the date out — why is it extending?
      </div>
      <div>
        <Label className="text-xs">Reason</Label>
        <Textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          rows={2}
          placeholder="e.g. Client added two new deliverables mid-stream"
        />
      </div>
      <div>
        <Label className="text-xs">Whose delay is this?</Label>
        <Select
          value={attribution}
          onValueChange={(v) => onAttributionChange(v as ExtensionAttribution)}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(EXTENSION_ATTRIBUTION_LABELS).map(([v, label]) => (
              <SelectItem key={v} value={v}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
