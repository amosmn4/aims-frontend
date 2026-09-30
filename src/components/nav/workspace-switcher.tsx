import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronDown, Layers } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth, homeRouteFor, WORKSPACE_LABELS, type WorkspaceCode } from "@/lib/auth";
import { cn } from "@/lib/utils";

/** Lets someone in more than one department choose which one they're working in. */
export function WorkspaceSwitcher({ className }: { className?: string }) {
  const { workspaces, workspace, setWorkspace, roles } = useAuth();
  const navigate = useNavigate();
  if (workspaces.length < 2 || !workspace) return null;

  const choose = (code: WorkspaceCode) => {
    setWorkspace(code);
    navigate({ to: homeRouteFor(roles, code) });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-sidebar-foreground hover:bg-white/20",
          className,
        )}
        aria-label={`Working in ${WORKSPACE_LABELS[workspace]}. Switch department`}
      >
        <Layers className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="max-w-32 truncate">{WORKSPACE_LABELS[workspace]}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          You work in more than one place. Pick the one to see.
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((code) => (
          <DropdownMenuItem
            key={code}
            className="cursor-pointer"
            onSelect={() => choose(code)}
            aria-current={code === workspace ? "true" : undefined}
          >
            <Check
              className={cn("h-4 w-4", code === workspace ? "opacity-100" : "opacity-0")}
              aria-hidden="true"
            />
            {WORKSPACE_LABELS[code]}
            {code === workspace && <span className="sr-only"> (showing now)</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
