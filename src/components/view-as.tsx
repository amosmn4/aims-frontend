import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Eye, Loader2, LogOut } from "lucide-react";
import { apiJson, setAccessToken } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Target = { id: string; fullName: string | null; email: string };

async function startViewAs(userId: string) {
  const { accessToken } = await apiJson<{ accessToken: string }>("/auth/view-as", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
  setAccessToken(accessToken);
  window.location.assign("/dashboard");
}

export function ViewAsButton() {
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const open = async () => {
    setBusy(true);
    try {
      const list = await apiJson<Target[]>("/auth/view-as/targets");
      if (list.length === 0) {
        toast.error("There's no CEO account yet. Give someone the CEO role in Staff.", {
          action: { label: "Open Staff", onClick: () => navigate({ to: "/admin/users" }) },
        });
      } else if (list.length === 1) {
        await startViewAs(list[0].id);
      } else {
        setTargets(list);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open the CEO view");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={open}
        disabled={busy}
        className="shrink-0 inline-flex items-center gap-1.5 h-8 px-2 rounded-md text-xs text-sidebar-foreground/90 hover:bg-white/10"
        title="See AIMS exactly as the CEO sees it"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
        <span className="hidden md:inline">View as CEO</span>
      </button>
      <Dialog open={!!targets} onOpenChange={(o) => !o && setTargets(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>View as CEO</DialogTitle>
            <DialogDescription>Choose whose view to open.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            {(targets ?? []).map((t) => (
              <Button
                key={t.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => startViewAs(t.id).catch((e) => toast.error(e.message))}
              >
                {t.fullName || t.email}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ViewAsBanner() {
  const { viewAs, profile } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!viewAs) return null;

  const exit = async () => {
    setBusy(true);
    try {
      const { accessToken } = await apiJson<{ accessToken: string }>("/auth/view-as/exit", {
        method: "POST",
      });
      setAccessToken(accessToken);
      window.location.assign("/dashboard");
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "Couldn't exit the CEO view");
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-500 px-4 py-1.5 text-xs font-medium text-amber-950">
      <Eye className="h-3.5 w-3.5" />
      <span>
        Viewing as {profile?.fullName || profile?.email}. Changes are turned off in this view.
      </span>
      <button
        onClick={exit}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded bg-amber-950/10 px-2 py-0.5 hover:bg-amber-950/20"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className="h-3 w-3" />}
        Exit view
      </button>
    </div>
  );
}
