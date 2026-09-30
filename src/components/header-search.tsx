import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Search, X } from "lucide-react";
import { useSearch, SEARCH_TYPE_LABELS, type SearchResult } from "@/features/search/use-search";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Shared query, results and keyboard selection for the inline box and the small-screen dialog.
function useHeaderSearchState(onDone: () => void) {
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const id = setTimeout(() => setQuery(rawQuery), 300);
    return () => clearTimeout(id);
  }, [rawQuery]);

  const searchQ = useSearch(query);
  const results = searchQ.data ?? [];
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r);
    return acc;
  }, {});
  // Keyboard order follows the on-screen grouped order.
  const ordered = Object.values(grouped).flat();

  useEffect(() => setActive(0), [query, results.length]);

  const reset = () => {
    setRawQuery("");
    setQuery("");
    setActive(0);
  };

  const select = (result: SearchResult | undefined) => {
    if (!result) return;
    reset();
    onDone();
    // `to` can carry a query string (e.g. /finance/invoices?q=INV-1), so navigate by href.
    navigate({ href: result.to });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && ordered.length > 0) {
      e.preventDefault();
      setActive((i) => (i + 1) % ordered.length);
    } else if (e.key === "ArrowUp" && ordered.length > 0) {
      e.preventDefault();
      setActive((i) => (i - 1 + ordered.length) % ordered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Ignore Enter until results for the typed text have arrived.
      if (rawQuery !== query) return;
      select(ordered[active] ?? ordered[0]);
    }
  };

  return {
    rawQuery,
    setRawQuery,
    query,
    searchQ,
    results,
    grouped,
    ordered,
    active,
    setActive,
    reset,
    select,
    onKeyDown,
  };
}

type SearchState = ReturnType<typeof useHeaderSearchState>;

function SearchResults({ state, listId }: { state: SearchState; listId: string }) {
  const { query, searchQ, results, grouped, ordered, active, setActive, select } = state;
  if (query.trim().length < 2) {
    return (
      <div className="px-3 py-4 text-center text-xs text-muted-foreground">
        Type at least 2 characters to search across every module you have access to.
      </div>
    );
  }
  if (searchQ.isFetching && results.length === 0) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (results.length === 0) {
    return <div className="px-3 py-4 text-center text-xs text-muted-foreground">No results.</div>;
  }
  return (
    <div id={listId} role="listbox" aria-label="Search results" className="py-1">
      {Object.entries(grouped).map(([type, items]) => {
        const label = SEARCH_TYPE_LABELS[type] ?? type;
        return (
          <div key={type} role="group" aria-label={label} className="px-1 py-1">
            <div
              aria-hidden="true"
              className="px-2 py-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground"
            >
              {label}
            </div>
            {items.map((r) => {
              const index = ordered.indexOf(r);
              const selected = index === active;
              return (
                <button
                  key={`${r.type}-${r.id}`}
                  id={`${listId}-${index}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  tabIndex={-1}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => select(r)}
                  className={cn(
                    "flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left text-sm hover:bg-secondary focus:outline-none",
                    selected && "bg-secondary",
                  )}
                >
                  <span className="truncate w-full">{r.title}</span>
                  <span className="truncate w-full text-xs text-muted-foreground">
                    {r.subtitle}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// Inline search on large screens; a search button that opens a dialog on smaller ones.
export function HeaderSearch({
  inputRef,
  className,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const dialogListId = useId();
  const inline = useHeaderSearchState(() => {
    setOpen(false);
    inputRef.current?.blur();
  });
  const compact = useHeaderSearchState(() => setDialogOpen(false));

  // Ctrl/Cmd+K focuses the inline box, or opens the dialog when the box is hidden.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) return;
      e.preventDefault();
      const input = inputRef.current;
      if (input && input.offsetParent !== null) input.focus();
      else setDialogOpen(true);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [inputRef]);

  const inlineHasResults = inline.query.trim().length >= 2 && inline.results.length > 0;
  const compactHasResults = compact.query.trim().length >= 2 && compact.results.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="lg:hidden shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md text-sidebar-foreground/80 hover:bg-white/10 hover:text-sidebar-foreground"
        aria-label="Search"
        title="Search"
      >
        <Search className="h-4 w-4" />
      </button>

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) compact.reset();
        }}
      >
        <DialogContent className="top-4 translate-y-0 sm:top-[10vh] p-4 gap-3">
          <DialogHeader>
            <DialogTitle className="text-base">Search</DialogTitle>
            <DialogDescription className="sr-only">
              Search everything you can access. Use the arrow keys to choose a result and Enter to
              open it.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={compact.rawQuery}
              onChange={(e) => compact.setRawQuery(e.target.value)}
              onKeyDown={compact.onKeyDown}
              role="combobox"
              aria-expanded={compactHasResults}
              aria-controls={dialogListId}
              aria-activedescendant={
                compactHasResults ? `${dialogListId}-${compact.active}` : undefined
              }
              aria-label="Search everything you can access"
              placeholder="Search everything you can access…"
              className="h-10 w-full rounded-md border bg-background pl-8 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            {compact.rawQuery && (
              <button
                type="button"
                onClick={compact.reset}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto rounded-md border">
            <SearchResults state={compact} listId={dialogListId} />
          </div>
        </DialogContent>
      </Dialog>

      <div
        ref={containerRef}
        className={cn("relative hidden lg:block w-48 xl:w-72 shrink-0", className)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
        }}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sidebar-foreground/50" />
          <input
            ref={inputRef}
            value={inline.rawQuery}
            onChange={(e) => {
              inline.setRawQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                (e.target as HTMLInputElement).blur();
                setOpen(false);
                return;
              }
              inline.onKeyDown(e);
            }}
            role="combobox"
            aria-expanded={open && inlineHasResults}
            aria-controls={listId}
            aria-activedescendant={
              open && inlineHasResults ? `${listId}-${inline.active}` : undefined
            }
            aria-label="Search everything you can access"
            placeholder="Search everything you can access…"
            className="h-8 w-full rounded-md bg-white/10 pl-8 pr-14 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/50 outline-none focus:bg-white/15 focus:ring-1 focus:ring-white/30"
          />
          {inline.rawQuery ? (
            <button
              type="button"
              onClick={inline.reset}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-sidebar-foreground/50 hover:text-sidebar-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[0.625rem] text-sidebar-foreground/40">
              Ctrl K
            </span>
          )}
        </div>

        {open && (
          <div className="absolute left-0 top-full z-40 mt-1 max-h-[70vh] w-full min-w-80 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-lg">
            <SearchResults state={inline} listId={listId} />
          </div>
        )}
      </div>
    </>
  );
}
