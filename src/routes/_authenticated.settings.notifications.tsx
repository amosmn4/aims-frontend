import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Phone, MessageSquare } from "lucide-react";
import {
  useNotificationPreferences,
  useSaveNotificationPreferences,
  type NotificationPreferences,
} from "@/features/notifications/use-notifications";
import {
  useAlertChannels,
  useSendTestSms,
  useSetAlertChannel,
  type AlertChannel,
  type AlertEventKey,
} from "@/features/settings/use-alert-channels";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/settings/notifications")({
  head: () => ({ meta: [{ title: "Notification Settings — AIMS" }] }),
  component: NotificationSettingsPage,
});

type InAppKey = Exclude<keyof NotificationPreferences, "email_digest">;

const IN_APP_KEY: Record<AlertEventKey, InAppKey | null> = {
  taskUpdates: "task_updates",
  projectUpdates: "project_updates",
  financeAlerts: "finance_alerts",
  tenderAlerts: "tender_alerts",
  remindersMeetings: "reminders_meetings",
  reports: null,
};

const CHANNELS: { key: AlertChannel; label: string; needsPhone: boolean }[] = [
  { key: "email", label: "Email", needsPhone: false },
  { key: "sms", label: "SMS", needsPhone: true },
  { key: "whatsapp", label: "WhatsApp", needsPhone: true },
];

const errorText = (err: unknown) =>
  err instanceof Error ? err.message : "Couldn't save. Please try again.";

function NotificationSettingsPage() {
  const prefsQ = useNotificationPreferences();
  const savePrefs = useSaveNotificationPreferences();
  const channelsQ = useAlertChannels();
  const setChannel = useSetAlertChannel();
  const testSms = useSendTestSms();
  const [local, setLocal] = useState<NotificationPreferences | null>(null);
  const [rowErrors, setRowErrors] = useState<Partial<Record<string, string>>>({});

  useEffect(() => {
    if (prefsQ.data && !local) setLocal(prefsQ.data);
  }, [prefsQ.data, local]);

  const setRowError = (row: string, message?: string) =>
    setRowErrors((e) => ({ ...e, [row]: message }));

  const toggleInApp = (key: keyof NotificationPreferences, value: boolean, row: string) => {
    if (!local) return;
    setLocal({ ...local, [key]: value });
    setRowError(row);
    savePrefs.mutate(
      { [key]: value },
      {
        onSuccess: () => toast.success("Alert setting saved"),
        onError: (err) => {
          setLocal((l) => (l ? { ...l, [key]: !value } : l));
          setRowError(row, errorText(err));
          toast.error(errorText(err));
        },
      },
    );
  };

  const toggleChannel = (eventKey: AlertEventKey, channel: AlertChannel, value: boolean) => {
    setRowError(eventKey);
    setChannel.mutate(
      { eventKey, [channel]: value },
      {
        onSuccess: () => toast.success("Alert setting saved"),
        onError: (err) => {
          setRowError(eventKey, errorText(err));
          toast.error(errorText(err));
        },
      },
    );
  };

  const channels = channelsQ.data;
  const loadError = prefsQ.error ?? channelsQ.error;
  const phoneMissing =
    !!channels && !channels.hasPhone && (channels.available.sms || channels.available.whatsapp);

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title="Notification settings"
        description="Choose where each kind of alert reaches you. Each switch saves as soon as you change it."
      />

      {loadError ? (
        <LoadError
          what="your alert settings"
          error={loadError}
          onRetry={() => {
            if (prefsQ.isError) void prefsQ.refetch();
            if (channelsQ.isError) void channelsQ.refetch();
          }}
        />
      ) : !local || !channels ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {phoneMissing && (
            <p className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm text-muted-foreground">
              <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
              SMS and WhatsApp need a phone number on your account.{" "}
              <Link to="/settings/profile" className="text-primary hover:underline">
                Add your phone number
              </Link>
            </p>
          )}

          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-56">Alert</TableHead>
                  <TableHead className="text-center">In AIMS</TableHead>
                  {CHANNELS.map((c) => (
                    <TableHead key={c.key} className="text-center align-bottom">
                      <div>{c.label}</div>
                      {!channels.available[c.key] && (
                        <div className="text-xs font-normal text-muted-foreground">
                          Not set up yet
                        </div>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.events.map((event) => {
                  const inAppKey = IN_APP_KEY[event.key] ?? null;
                  const choice = channels.preferences[event.key] ?? {
                    email: false,
                    sms: false,
                    whatsapp: false,
                  };
                  const error = rowErrors[event.key];
                  return (
                    <TableRow key={event.key}>
                      <TableCell>
                        <div className="text-sm font-medium">{event.label}</div>
                        {error && (
                          <p role="alert" className="text-xs text-destructive mt-0.5">
                            {error}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {inAppKey ? (
                          <Switch
                            checked={local[inAppKey]}
                            onCheckedChange={(v) => toggleInApp(inAppKey, v, event.key)}
                            aria-label={`${event.label} in AIMS`}
                          />
                        ) : (
                          <div className="inline-flex flex-col items-center gap-0.5">
                            <Switch checked disabled aria-label={`${event.label} in AIMS`} />
                            <span className="text-xs text-muted-foreground">Always on</span>
                          </div>
                        )}
                      </TableCell>
                      {CHANNELS.map((c) => (
                        <TableCell key={c.key} className="text-center">
                          <Switch
                            checked={choice[c.key]}
                            disabled={
                              !channels.available[c.key] || (c.needsPhone && !channels.hasPhone)
                            }
                            onCheckedChange={(v) => toggleChannel(event.key, c.key, v)}
                            aria-label={`${event.label} by ${c.label}`}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {channels.available.sms && channels.hasPhone && (
            <div className="rounded-lg border bg-card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium">Check SMS works on your phone</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  We'll text your number once so you know alerts will reach you.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={testSms.isPending}
                onClick={() =>
                  testSms
                    .mutateAsync()
                    .then(() => toast.success("Test SMS sent — check your phone"))
                    .catch((err) =>
                      toast.error(
                        err instanceof Error && err.message
                          ? err.message
                          : "Couldn't send the test SMS",
                      ),
                    )
                }
              >
                {testSms.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquare className="mr-1 h-4 w-4" />
                )}
                Send me a test SMS
              </Button>
            </div>
          )}

          <div className="rounded-lg border bg-card flex items-center justify-between gap-4 p-4">
            <div>
              <Label htmlFor="email-digest" className="text-sm font-medium">
                Daily email digest
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                A once-a-day email of what's still unread in AIMS.
              </p>
              {rowErrors.email_digest && (
                <p role="alert" className="text-xs text-destructive mt-0.5">
                  {rowErrors.email_digest}
                </p>
              )}
            </div>
            <Switch
              id="email-digest"
              checked={local.email_digest}
              onCheckedChange={(v) => toggleInApp("email_digest", v, "email_digest")}
            />
          </div>
        </>
      )}
    </div>
  );
}
