import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  ChevronDown,
  CircleHelp,
  Crown,
  LifeBuoy,
  LogOut,
  PanelLeft,
  PanelTop,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth, ROLE_LABELS } from "@/lib/auth";
import type { LayoutMode } from "@/lib/layout-preference";
import { cn } from "@/lib/utils";

export function UserMenu({
  layoutMode,
  onLayoutChange,
  showLayoutSwitch,
  nameClassName,
}: {
  layoutMode: LayoutMode;
  onLayoutChange: (mode: LayoutMode) => void;
  showLayoutSwitch: boolean;
  nameClassName?: string;
}) {
  const { profile, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const displayName = profile?.fullName || profile?.email || "Your account";
  const roleLabel = roles.filter((r) => r !== "system_admin").map((r) => ROLE_LABELS[r])[0];

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate({ to: "/auth" });
    } catch {
      toast.error("Couldn't sign you out. Check your connection and try again.");
    }
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Your account"
          title="Your account"
          className="shrink-0 inline-flex items-center gap-2 h-9 rounded-md px-1.5 text-sidebar-foreground hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <span
            aria-hidden="true"
            className="h-7 w-7 shrink-0 rounded-full bg-accent text-accent-foreground text-xs font-semibold flex items-center justify-center"
          >
            {displayName.charAt(0).toUpperCase()}
          </span>
          <span className={cn("max-w-36 truncate text-xs font-medium", nameClassName)}>
            {displayName}
          </span>
          <ChevronDown className="h-3 w-3 opacity-70" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="text-sm font-medium truncate">{displayName}</div>
          {profile?.fullName && profile.email && (
            <div className="text-xs text-muted-foreground truncate">{profile.email}</div>
          )}
          {roleLabel && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              {roles.includes("ceo") && (
                <Crown className="h-3 w-3 text-accent" aria-hidden="true" />
              )}
              {roleLabel}
            </div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/settings/profile">
            <UserRound aria-hidden="true" /> My profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/settings/notifications">
            <Bell aria-hidden="true" /> My notifications
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/guide">
            <CircleHelp aria-hidden="true" /> Help
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/it-help">
            <LifeBuoy aria-hidden="true" /> Ask IT for help
          </Link>
        </DropdownMenuItem>
        {showLayoutSwitch && (
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => onLayoutChange(layoutMode === "top" ? "sidebar" : "top")}
          >
            {layoutMode === "top" ? (
              <>
                <PanelLeft aria-hidden="true" /> Show menu on the left
              </>
            ) : (
              <>
                <PanelTop aria-hidden="true" /> Show menu across the top
              </>
            )}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onSelect={() => void handleSignOut()}>
          <LogOut aria-hidden="true" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
