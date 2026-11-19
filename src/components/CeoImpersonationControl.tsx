import ManageAccountsOutlined from "@mui/icons-material/ManageAccountsOutlined";
import ExitToAppOutlined from "@mui/icons-material/ExitToAppOutlined";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useAccount } from "@/lib/account";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

export function CeoImpersonationControl() {
  const { account, startImpersonation, stopImpersonation } = useAccount();
  const { accounts, people } = useWorkspace();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ceos = accounts.filter((row) => row.role === "ceo" && row.active);
  const acting = !!account?.impersonation;
  if (!acting && (account?.role !== "system_admin" || !startImpersonation)) return null;
  const change = async (staffId?: string) => {
    setBusy(true);
    try {
      const onSwitched = () => navigate({ to: acting ? "/system-admin" : "/" });
      if (acting) await stopImpersonation?.(onSwitched);
      else if (staffId) await startImpersonation?.(staffId, onSwitched);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The workspace could not switch.");
    } finally {
      setBusy(false);
    }
  };
  const label = acting ? "Return to System Admin" : "Open CEO workspace";
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={
          acting
            ? "shrink-0 border border-sidebar-foreground/40 text-sidebar-foreground hover:bg-sidebar-accent"
            : "shrink-0 text-sidebar-foreground hover:bg-sidebar-accent"
        }
        disabled={busy || (!acting && ceos.length === 0)}
        aria-label={label}
        aria-pressed={acting}
        title={
          acting
            ? `CEO session operated by ${account.impersonation?.name}. ${label}`
            : ceos.length
              ? label
              : "No active CEO account is available"
        }
        onClick={() => {
          if (acting) void change();
          else if (ceos.length === 1) void change(ceos[0]!.personId);
          else setOpen(true);
        }}
      >
        {acting ? (
          <ExitToAppOutlined fontSize="small" />
        ) : (
          <ManageAccountsOutlined fontSize="small" />
        )}
      </Button>
      {open && (
        <Dialog open onOpenChange={setOpen}>
          <DialogContent className="max-h-[80vh] overflow-y-auto" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>CEO account</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {ceos.map((ceo) => (
                <Button
                  key={ceo.id}
                  variant="outline"
                  className="h-auto w-full justify-start px-4 py-3 text-left"
                  disabled={busy}
                  onClick={() => void change(ceo.personId)}
                >
                  <span>
                    <span className="block">
                      {people.find((person) => person.id === ceo.personId)?.name ?? ceo.email}
                    </span>
                    <span className="block text-xs text-muted-foreground">{ceo.email}</span>
                  </span>
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
