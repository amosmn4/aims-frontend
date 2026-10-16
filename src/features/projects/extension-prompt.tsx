import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
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

// Shown on project/task edit forms when a date is pushed later, to record why.
export function isExtension(previousDate: string | null | undefined, newDate: string): boolean {
  if (!previousDate || !newDate) return false;
  return new Date(newDate).getTime() > new Date(previousDate).getTime();
}

export function ExtensionPrompt({
  reason,
  onReasonChange,
  attribution,
  onAttributionChange,
  reasonError,
  idPrefix = "extension",
}: {
  reason: string;
  onReasonChange: (v: string) => void;
  attribution: ExtensionAttribution;
  onAttributionChange: (v: ExtensionAttribution) => void;
  reasonError?: string;
  idPrefix?: string;
}) {
  return (
    <div className="rounded-md border border-warning/30 bg-warning/5 p-3 space-y-2">
      <div className="text-xs font-medium text-warning">
        This moves the date later. Record why, so there&apos;s a history of delays.
      </div>
      <FormField id={`${idPrefix}-reason`} label="Reason" required error={reasonError}>
        <Textarea
          id={`${idPrefix}-reason`}
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          rows={2}
          placeholder="e.g. Client added two new deliverables"
          aria-invalid={!!reasonError}
        />
      </FormField>
      <FormField id={`${idPrefix}-attribution`} label="Whose delay is this?">
        <Select
          value={attribution}
          onValueChange={(v) => onAttributionChange(v as ExtensionAttribution)}
        >
          <SelectTrigger id={`${idPrefix}-attribution`} className="h-9">
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
      </FormField>
    </div>
  );
}
