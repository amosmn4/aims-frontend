import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Bell } from "lucide-react";
import {
  useNotificationPreferences,
  useSaveNotificationPreferences,
  type NotificationPreferences,
} from "@/features/notifications/use-notifications";
import { PageHeader } from "@/components/app-shell";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/settings/notifications")({
  head: () => ({ meta: [{ title: "Notification Settings — AIMS" }] }),
  component: NotificationSettingsPage,
});

const TOGGLES: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  {
    key: "task_updates",
    label: "Task updates",
    description: "Assigned to a task, a task's due soon or overdue, someone comments on your task",
  },
  {
    key: "project_updates",
    label: "Project updates",
    description:
      "A project is overdue, or a project (including a restricted one) is shared with you",
  },
  {
    key: "finance_alerts",
    label: "Finance alerts",
    description: "Contract renewal approaching, invoice overdue",
  },
  {
    key: "tender_alerts",
    label: "Tender alerts",
    description: "Tender submission deadline approaching",
  },
  {
    key: "reminders_meetings",
    label: "Reminders & meetings",
    description: "Manual reminders and meetings logged for you",
  },
  {
    key: "email_digest",
    label: "Daily email digest",
    description: "A once-a-day email summarizing what's still unread — separate from in-app alerts",
  },
];

function NotificationSettingsPage() {
  const prefsQ = useNotificationPreferences();
  const save = useSaveNotificationPreferences();
  const [local, setLocal] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    if (prefsQ.data && !local) setLocal(prefsQ.data);
  }, [prefsQ.data, local]);

  const toggle = (key: keyof NotificationPreferences, value: boolean) => {
    if (!local) return;
    const next = { ...local, [key]: value };
    setLocal(next);
    save.mutate(
      { [key]: value },
      {
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to save");
          setLocal(local);
        },
      },
    );
  };

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader
        title="Notification settings"
        description="Choose which categories notify you in-app and by email. Everything is on by default."
      />

      {prefsQ.isLoading || !local ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="rounded-lg border bg-card divide-y">
          {TOGGLES.map((t) => (
            <div key={t.key} className="flex items-center justify-between gap-4 p-4">
              <div className="flex items-start gap-3">
                <Bell className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <Label className="text-sm font-medium">{t.label}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                </div>
              </div>
              <Switch
                checked={local[t.key]}
                onCheckedChange={(v) => toggle(t.key, v)}
                disabled={save.isPending}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
