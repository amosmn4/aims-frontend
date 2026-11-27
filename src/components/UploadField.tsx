import { useState, type InputHTMLAttributes } from "react";
import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";

export function UploadField({
  busy = false,
  compact = false,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { busy?: boolean; compact?: boolean }) {
  const [name, setName] = useState("");
  return (
    <span
      className={`relative flex min-w-0 items-center gap-3 rounded-lg border border-dashed bg-muted/30 text-sm focus-within:ring-2 focus-within:ring-primary ${compact ? "min-h-12 px-3 py-2" : "min-h-24 p-4"}`}
    >
      <UploadFileOutlined className="shrink-0 text-muted-foreground" />
      <span className="min-w-0">
        <span className="block truncate font-medium">
          {busy ? "Uploading..." : name || "Choose a document or image"}
        </span>
        <span className="text-xs text-muted-foreground">
          {busy ? "Please wait for the upload to finish" : "Select a file up to 25 MB"}
        </span>
      </span>
      <input
        {...props}
        type="file"
        disabled={busy || props.disabled}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        onChange={(event) => {
          const file = event.target.files?.[0];
          setName(file ? `${file.name} (${(file.size / 1024).toFixed(0)} KB)` : "");
          props.onChange?.(event);
        }}
      />
    </span>
  );
}
