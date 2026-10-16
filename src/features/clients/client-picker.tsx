import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { useClients, type Client } from "@/features/finance/use-finance-data";
import { useClientPermissions } from "@/features/clients/use-clients-contracts";
import { ClientFormDialog } from "@/features/clients/client-form-dialog";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MAX_SHOWN = 100;

type Option = { kind: "none" } | { kind: "client"; client: Client } | { kind: "create" };

/**
 * Searchable client picker that can also create the client inline.
 * `departmentId` stamps the capturing department on a new client.
 */
export function ClientPicker({
  value,
  onChange,
  placeholder = "Select a client…",
  allowNone = false,
  suggestedName,
  departmentId,
  id,
  invalid,
  disabled,
}: {
  value: string;
  onChange: (clientId: string) => void;
  placeholder?: string;
  /** Adds a "No client" option that maps to an empty string. */
  allowNone?: boolean;
  /** Prefills the create form, e.g. a tender's prospect company name. */
  suggestedName?: string | null;
  departmentId?: string;
  /** Lets a FormField label point at the picker. */
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const clientsQ = useClients();
  const { canCreateClient } = useClientPermissions();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [createName, setCreateName] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;

  const clients = useMemo(() => clientsQ.data ?? [], [clientsQ.data]);
  const selectedName =
    clients.find((c) => c.id === value)?.name ?? (created?.id === value ? created.name : null);

  const needle = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      needle
        ? clients.filter(
            (c) =>
              c.name.toLowerCase().includes(needle) ||
              (c.code ?? "").toLowerCase().includes(needle),
          )
        : clients,
    [clients, needle],
  );
  const shown = matches.slice(0, MAX_SHOWN);

  const options: Option[] = [
    ...(allowNone && !needle ? [{ kind: "none" } as const] : []),
    ...shown.map((client) => ({ kind: "client", client }) as const),
    ...(canCreateClient ? [{ kind: "create" } as const] : []),
  ];

  useEffect(() => setActive(0), [needle, open]);
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (option: Option) => {
    if (option.kind === "create") {
      setCreateName(query.trim() || suggestedName || "");
      setOpen(false);
      return;
    }
    onChange(option.kind === "none" ? "" : option.client.id);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = options[active];
      if (option) choose(option);
    }
  };

  const optionClass = (index: number) =>
    cn(
      "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm",
      index === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
    );

  let index = -1;

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setQuery("");
        }}
        modal
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              !selectedName && "text-muted-foreground",
              invalid && "border-destructive",
            )}
          >
            <span className="truncate">
              {selectedName ?? (value && clientsQ.isLoading ? "Loading client…" : placeholder)}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-64 p-0">
          <div className="border-b p-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search clients by name or code"
              aria-label="Search clients"
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={options[active] ? `${baseId}-opt-${active}` : undefined}
              className="h-9"
            />
          </div>
          <div ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto p-1">
            {allowNone && !needle && (
              <OptionButton
                id={`${baseId}-opt-${++index}`}
                index={index}
                className={optionClass(index)}
                selected={!value}
                onClick={() => choose({ kind: "none" })}
              >
                No client
              </OptionButton>
            )}

            {clientsQ.isLoading ? (
              <p className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading clients…
              </p>
            ) : clientsQ.isError ? (
              <LoadError
                what="clients"
                error={clientsQ.error}
                onRetry={() => clientsQ.refetch()}
                className="m-1 p-3"
              />
            ) : clients.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">No clients yet.</p>
            ) : matches.length === 0 ? (
              <div className="flex flex-wrap items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                <span>No clients match "{query.trim()}".</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => setQuery("")}>
                  Clear search
                </Button>
              </div>
            ) : (
              shown.map((c) => {
                const i = ++index;
                return (
                  <OptionButton
                    key={c.id}
                    id={`${baseId}-opt-${i}`}
                    index={i}
                    className={optionClass(i)}
                    selected={c.id === value}
                    onClick={() => choose({ kind: "client", client: c })}
                  >
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    {c.code && <span className="text-xs text-muted-foreground">{c.code}</span>}
                    {!c.is_active && (
                      <span className="text-xs text-muted-foreground">Inactive</span>
                    )}
                  </OptionButton>
                );
              })
            )}
            {matches.length > MAX_SHOWN && (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                Showing {MAX_SHOWN} of {matches.length}. Type to narrow the list.
              </p>
            )}
          </div>
          <div className="border-t p-1">
            {canCreateClient ? (
              <OptionButton
                id={`${baseId}-opt-${++index}`}
                index={index}
                className={cn(optionClass(index), "font-medium text-primary")}
                selected={false}
                hideCheck
                onClick={() => choose({ kind: "create" })}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span className="truncate">
                  Create new client{query.trim() ? ` "${query.trim()}"` : ""}
                </span>
              </OptionButton>
            ) : (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                Can't find the client? Ask your department head to add it.
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <ClientFormDialog
        open={createName !== null}
        onOpenChange={(o) => !o && setCreateName(null)}
        defaultName={createName ?? ""}
        departmentId={departmentId}
        onSaved={(client) => {
          setCreated(client);
          setQuery("");
          onChange(client.id);
        }}
        onUseExisting={(client) => {
          setQuery("");
          onChange(client.id);
        }}
      />
    </>
  );
}

function OptionButton({
  id,
  index,
  selected,
  className,
  onClick,
  hideCheck,
  children,
}: {
  id: string;
  index: number;
  selected: boolean;
  hideCheck?: boolean;
  className: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      id={id}
      role="option"
      aria-selected={selected}
      data-index={index}
      tabIndex={-1}
      className={className}
      onClick={onClick}
    >
      {!hideCheck && (
        <Check
          className={cn("h-4 w-4 shrink-0", selected ? "opacity-100" : "opacity-0")}
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}

/** Standalone "new client" dialog; kept for callers outside a picker. */
export function NewClientDialog({
  open,
  onOpenChange,
  onCreated,
  defaultName = "",
  departmentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (clientId: string) => void;
  defaultName?: string;
  departmentId?: string;
}) {
  return (
    <ClientFormDialog
      open={open}
      onOpenChange={onOpenChange}
      defaultName={defaultName}
      departmentId={departmentId}
      onSaved={(client) => onCreated?.(client.id)}
    />
  );
}
