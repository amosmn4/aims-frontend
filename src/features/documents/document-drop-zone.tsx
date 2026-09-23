import { useRef, useState, type DragEvent } from "react";
import { Check, CloudUpload, TriangleAlert } from "lucide-react";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_ACCEPT_HINT,
  formatFileSize,
} from "@/features/documents/use-documents";
import type { UploadItem } from "@/features/documents/use-document-uploads";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/** Drag files onto it, or press the button — both end up in `onFiles`. */
export function DocumentDropZone({
  onFiles,
  disabled = false,
  multiple = true,
  label = "Drag files here",
  className,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  multiple?: boolean;
  label?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1));
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    if (!disabled) take(e.dataTransfer.files);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn(
        "rounded-lg border border-dashed bg-card px-4 py-5 text-center transition-colors",
        over && !disabled ? "border-primary bg-primary/5" : "border-muted-foreground/30",
        disabled && "opacity-60",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={DOCUMENT_ACCEPT}
        multiple={multiple}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />
      <CloudUpload className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
      <p className="mt-2 text-sm font-medium">{label}</p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-2"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {multiple ? "Choose files" : "Choose a file"}
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">{DOCUMENT_ACCEPT_HINT}</p>
    </div>
  );
}

/** One row per file being sent, so people can see what worked and what didn't. */
export function UploadProgressList({
  items,
  className,
}: {
  items: UploadItem[];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <ul className={cn("space-y-2 rounded-lg border bg-card p-3", className)}>
      {items.map((item) => (
        <li key={item.id} className="text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-medium">{item.name}</span>
            <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
              {item.status === "done" && (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> Added
                </>
              )}
              {item.status === "failed" && (
                <>
                  <TriangleAlert className="h-3.5 w-3.5 text-destructive" aria-hidden="true" /> Not
                  added
                </>
              )}
              {item.status === "uploading" && `${item.progress}%`}
              {item.status === "waiting" && "Waiting"}
            </span>
          </div>
          {item.status === "uploading" && <Progress value={item.progress} className="mt-1 h-1.5" />}
          {item.status === "failed" ? (
            <p role="alert" className="mt-1 text-destructive">
              {item.error}
            </p>
          ) : (
            <p className="mt-0.5 text-muted-foreground">{formatFileSize(item.size)}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
