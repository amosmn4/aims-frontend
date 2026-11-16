import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/production/components/ui/button";
export function RowActions({
  label,
  onEdit,
  onDelete,
  disabled,
}: {
  label: string;
  onEdit?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
  disabled?: boolean | undefined;
}) {
  return (
    <div className="flex justify-end gap-1">
      {onEdit && (
        <Button
          size="icon"
          variant="ghost"
          onClick={onEdit}
          disabled={disabled}
          title={`Edit ${label}`}
          aria-label={`Edit ${label}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
      {onDelete && (
        <Button
          size="icon"
          variant="ghost"
          onClick={onDelete}
          disabled={disabled}
          title={`Delete ${label}`}
          aria-label={`Delete ${label}`}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
