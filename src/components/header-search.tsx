import { useEffect, useRef, useState, type RefObject } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Search, X } from "lucide-react";
import { useSearch, SEARCH_TYPE_LABELS, type SearchResult } from "@/features/search/use-search";
import { cn } from "@/lib/utils";

// Inline, always-visible search — anchored dropdown under the input, not a full-screen modal
// takeover. Ctrl/Cmd+K (wired in AppShell) just focuses this input rather than toggling a dialog.
export function HeaderSearch({ inputRef }: { inputRef: RefObject<HTMLInputElement | null> }) {
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
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

  const reset = () => {
    setRawQuery("");
    setQuery("");
    setOpen(false);
  };

  const select = (result: SearchResult) => {
    reset();
    navigate({ to: result.to });
  };

  const showDropdown = open;

  return (
    <div
      ref={containerRef}
      className="relative hidden lg:block w-48 xl:w-72 shrink-0"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sidebar-foreground/50" />
        <input
          ref={inputRef}
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              (e.target as HTMLInputElement).blur();
              setOpen(false);
            }
          }}
          placeholder="Search everything you can access…"
          className="h-8 w-full rounded-md bg-white/10 pl-8 pr-14 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/50 outline-none focus:bg-white/15 focus:ring-1 focus:ring-white/30"
        />
        {rawQuery ? (
          <button
            type="button"
            onClick={reset}
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

      {showDropdown && (
        <div className="absolute left-0 top-full z-40 mt-1 max-h-[70vh] w-full min-w-80 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-lg">
          {query.trim().length < 2 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              Type at least 2 characters to search across every module you have access to.
            </div>
          ) : searchQ.isFetching ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">No results.</div>
          ) : (
            <div className="py-1">
              {Object.entries(grouped).map(([type, items]) => (
                <div key={type} className="px-1 py-1">
                  <div className="px-2 py-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                    {SEARCH_TYPE_LABELS[type] ?? type}
                  </div>
                  {items.map((r) => (
                    <button
                      key={`${r.type}-${r.id}`}
                      type="button"
                      onClick={() => select(r)}
                      className={cn(
                        "flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left text-sm hover:bg-secondary focus:bg-secondary focus:outline-none",
                      )}
                    >
                      <span className="truncate w-full">{r.title}</span>
                      <span className="truncate w-full text-xs text-muted-foreground">
                        {r.subtitle}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
