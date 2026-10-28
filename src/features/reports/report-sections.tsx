import { useState, type ReactNode } from "react";
import { ExternalLink, Loader2, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ProvenanceChip } from "./report-figures";
import type { ReportListItem, ReportSection } from "./use-reports";

/** One block of a report: its name, where its content came from, and its body. */
export function SectionCard({
  title,
  required = false,
  chip,
  children,
  highlight = false,
}: {
  title: string;
  required?: boolean;
  chip?: ReactNode;
  children: ReactNode;
  highlight?: boolean;
}) {
  return (
    <section
      className={cn("rounded-lg border bg-card", highlight && "border-primary/40")}
      aria-label={title}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">
          {title}
          {required && (
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          )}
          {required && <span className="sr-only"> (needed before you can send)</span>}
        </h2>
        {chip}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ListItemRow({
  item,
  readOnly,
  onRemove,
}: {
  item: ReportListItem;
  readOnly: boolean;
  onRemove: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2">
      <span className="min-w-[10rem] flex-1 text-sm">
        {item.link ? (
          <a
            href={item.link}
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            {item.text}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        ) : (
          item.text
        )}
        {item.when && <span className="ml-2 text-xs text-muted-foreground">{item.when}</span>}
      </span>
      <ProvenanceChip source={item.source} />
      {!readOnly && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-muted-foreground"
          onClick={onRemove}
          aria-label={`Remove “${item.text}”`}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </li>
  );
}

function ItemList({
  section,
  readOnly,
  onChange,
}: {
  section: ReportSection;
  readOnly: boolean;
  onChange: (next: ReportSection) => void;
}) {
  const [text, setText] = useState("");
  const items = section.items ?? [];
  const add = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onChange({ ...section, items: [...items, { text: trimmed, source: "typed" }] });
    setText("");
  };

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {readOnly ? "Nothing was listed here." : "Nothing here yet. Add what is worth saying."}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <ListItemRow
              key={`${item.text}-${i}`}
              item={item}
              readOnly={readOnly}
              onRemove={() =>
                onChange({ ...section, items: items.filter((_, index) => index !== i) })
              }
            />
          ))}
        </ul>
      )}
      {!readOnly && (
        <div className="flex gap-2">
          <Input
            className="h-9"
            aria-label={`Add your own line to ${section.title}`}
            placeholder="Add your own…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              add();
            }}
          />
          <Button size="sm" variant="outline" onClick={add} disabled={!text.trim()}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
      )}
    </div>
  );
}

function Narrative({
  section,
  readOnly,
  canDraft,
  drafting,
  onChange,
  onDraft,
}: {
  section: ReportSection;
  readOnly: boolean;
  canDraft: boolean;
  drafting: boolean;
  onChange: (next: ReportSection) => void;
  onDraft?: () => void;
}) {
  if (readOnly) {
    return section.body?.trim() ? (
      <p className="whitespace-pre-wrap text-sm">{section.body}</p>
    ) : (
      <p className="text-sm text-muted-foreground">Nothing was written here.</p>
    );
  }
  return (
    <div className="space-y-2">
      {section.hint && <p className="text-xs text-muted-foreground">{section.hint}</p>}
      <Textarea
        id={`section-${section.id}`}
        aria-label={section.title}
        rows={5}
        value={section.body ?? ""}
        placeholder="Write it in your own words…"
        onChange={(e) => onChange({ ...section, body: e.target.value, source: "typed" })}
      />
      {canDraft && onDraft && (
        <Button size="sm" variant="outline" onClick={onDraft} disabled={drafting}>
          {drafting ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-1 h-4 w-4" />
          )}
          Draft this with AI
        </Button>
      )}
    </div>
  );
}

/** A section of the report a person writes or prunes. Figures are handled separately. */
export function ReportSectionEditor({
  section,
  readOnly = false,
  aiEnabled = false,
  drafting = false,
  onChange,
  onDraft,
}: {
  section: ReportSection;
  readOnly?: boolean;
  aiEnabled?: boolean;
  drafting?: boolean;
  onChange: (next: ReportSection) => void;
  onDraft?: () => void;
}) {
  const pulled = (section.items ?? []).filter((i) => i.source === "aims").length;
  const isList = section.type === "list" || section.type === "risks";
  const chip = isList ? (
    pulled > 0 ? (
      <ProvenanceChip source="aims" label={`${pulled} from AIMS`} />
    ) : (
      <ProvenanceChip source="typed" label="Yours" />
    )
  ) : (
    <ProvenanceChip source={section.source ?? "typed"} />
  );

  return (
    <SectionCard title={section.title} required={section.required} chip={chip}>
      {isList ? (
        <div className="space-y-2">
          {section.hint && !readOnly && (
            <p className="text-xs text-muted-foreground">{section.hint}</p>
          )}
          <ItemList section={section} readOnly={readOnly} onChange={onChange} />
        </div>
      ) : (
        <Narrative
          section={section}
          readOnly={readOnly}
          canDraft={aiEnabled && section.type === "narrative"}
          drafting={drafting}
          onChange={onChange}
          onDraft={onDraft}
        />
      )}
    </SectionCard>
  );
}
