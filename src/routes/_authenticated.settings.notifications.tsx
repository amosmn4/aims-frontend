import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { BellOff, BellRing, Loader2, MessageSquare, Phone } from "lucide-react";
import {
  useNotificationPreferences,
  useSaveNotificationPreferences,
  type NotificationPreferences,
} from "@/features/notifications/use-notifications";
import { MuteMenu, MutedBadge } from "@/features/notifications/mute-menu";
import {
  alertPreference,
  useAlertChannels,
  useMuteAllAlerts,
  useSendTestSms,
  useSetAlertChannel,
  type AlertChannel,
  type AlertEventKey,
} from "@/features/settings/use-alert-channels";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { ActionHint } from "@/components/help-link";
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
import { formatDate } from "@/lib/format-date";

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
  const muteAll = useMuteAllAlerts();
  const testSms = useSendTestSms();
  const [local, setLocal] = useState<NotificationPreferences | null>(null);
  const [rowErrors, setRowErrors] = useState<Partial<Record<string, string>>>({});

  useEffect(() => {
    if (prefsQ.data && !local) setLocal(prefsQ.data);
  }, [prefsQ.data, local]);

  const setRowError = (row: string, message?: string) =>
    setRowErrors((e) => ({ ...e, [row]: message }));

  const saveLegacy = (
    key: keyof NotificationPreferences,
    value: boolean,
    row: string,
    onSaved?: () => void,
  ) => {
    setLocal((l) => (l ? { ...l, [key]: value } : l));
    savePrefs.mutate(
      { [key]: value },
      {
        onSuccess: () => onSaved?.(),
        onError: (err) => {
          setLocal((l) => (l ? { ...l, [key]: !value } : l));
          setRowError(row, errorText(err));
          toast.error(errorText(err));
        },
      },
    );
  };

  const toggleEmailDigest = (value: boolean) => {
    setRowError("email_digest");
    saveLegacy("email_digest", value, "email_digest", () =>
      toast.success(value ? "Daily digest turned on" : "Daily digest turned off"),
    );
  };

  // The bell switch also keeps the older category setting in step, so both agree.
  const toggleInApp = (eventKey: AlertEventKey, value: boolean) => {
    setRowError(eventKey);
    const legacyKey = IN_APP_KEY[eventKey];
    if (legacyKey) saveLegacy(legacyKey, value, eventKey);
    setChannel.mutate(
      { eventKey, inApp: value },
      {
        onSuccess: () =>
          toast.success(value ? "AIMS will send these alerts" : "AIMS won't send these alerts"),
        onError: (err) => {
          setRowError(eventKey, errorText(err));
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

  const muteRow = (eventKey: AlertEventKey, mutedUntil: string | null) => {
    setRowError(eventKey);
    setChannel.mutate(
      { eventKey, mutedUntil },
      {
        onSuccess: () =>
          toast.success(
            mutedUntil ? `Muted until ${formatDate(mutedUntil)}` : "This alert is back on",
          ),
        onError: (err) => {
          setRowError(eventKey, errorText(err));
          toast.error(errorText(err));
        },
      },
    );
  };

  const muteEverything = (mutedUntil: string | null) => {
    muteAll.mutate(mutedUntil, {
      onSuccess: () =>
        toast.success(
          mutedUntil
            ? `All alerts paused until ${formatDate(mutedUntil)}`
            : "All alerts are back on",
        ),
      onError: (err) => toast.error(errorText(err)),
    });
  };

  const channels = channelsQ.data;
  const loadError = prefsQ.error ?? channelsQ.error;
  const phoneMissing =
    !!channels && !channels.hasPhone && (channels.available.sms || channels.available.whatsapp);

  const mutedEvents = (channels?.events ?? []).filter(
    (e) => alertPreference(channels, e.key).muted,
  );
  const anyMuted = mutedEvents.length > 0;
  const allMuted = !!channels && mutedEvents.length === channels.events.length;
  // The furthest date tells people when everything is back on.
  const pauseEndsOn = mutedEvents
    .map((e) => alertPreference(channels, e.key).mutedUntil)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);

  return (
    <div className="max-w-4xl space-y-4">
      <PageHeader
        title="Notification settings"
        description="Choose where each kind of alert reaches you, and pause the ones you don't want right now. Every change saves straight away."
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
          <section
            className={`rounded-lg border p-4 ${anyMuted ? "border-primary/40 bg-primary/5" : "bg-card"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                {anyMuted ? (
                  <BellOff className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                ) : (
                  <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                )}
                <div>
                  <p className="text-sm font-medium">
                    {!anyMuted
                      ? "All your alerts are on"
                      : allMuted
                        ? `All alerts are paused until ${formatDate(pauseEndsOn)}`
                        : `${mutedEvents.length} of ${channels.events.length} alert types are paused`}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {anyMuted
                      ? "Paused alerts start again on their own — you don't have to remember."
                      : "Pause everything for a while if you're away or in a busy week."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {anyMuted && (
                  <Button
                    size="sm"
                    disabled={muteAll.isPending}
                    onClick={() => muteEverything(null)}
                  >
                    <BellRing className="mr-1 h-4 w-4" aria-hidden="true" />
                    Turn alerts back on
                  </Button>
                )}
                <MuteMenu
                  verb="Pause"
                  showUnmute={anyMuted}
                  onMute={muteEverything}
                  onUnmute={() => muteEverything(null)}
                  trigger={
                    <Button size="sm" variant="outline" disabled={muteAll.isPending}>
                      {muteAll.isPending ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <BellOff className="mr-1 h-4 w-4" aria-hidden="true" />
                      )}
                      {anyMuted ? "Change how long" : "Pause all alerts"}
                    </Button>
                  }
                />
              </div>
            </div>
          </section>

          <ActionHint topic="choose how alerts reach you">
            Switching an alert <strong>off</strong> stops it for good. <strong>Muting</strong> only
            pauses it, and it comes back on by itself on the date you pick.
          </ActionHint>

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
                  {CHANNELS.map((c) => {
                    const blocked = !channels.available[c.key]
                      ? "Not set up yet"
                      : c.needsPhone && !channels.hasPhone
                        ? "Needs your phone number"
                        : null;
                    return (
                      <TableHead key={c.key} className="text-center align-bottom">
                        <div>{c.label}</div>
                        {blocked && (
                          <div className="text-xs font-normal text-muted-foreground">{blocked}</div>
                        )}
                      </TableHead>
                    );
                  })}
                  <TableHead className="min-w-44 text-right">Pause</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.events.map((event) => {
                  const legacyKey = IN_APP_KEY[event.key];
                  const pref = alertPreference(channels, event.key);
                  const inAppOn = pref.inApp && (legacyKey ? local[legacyKey] : true);
                  const error = rowErrors[event.key];
                  return (
                    <TableRow key={event.key}>
                      <TableCell>
                        <div className="text-sm font-medium">{event.label}</div>
                        {!inAppOn && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Turned off — AIMS sends nothing of this kind.
                          </p>
                        )}
                        {error && (
                          <p role="alert" className="text-xs text-destructive mt-0.5">
                            {error}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={inAppOn}
                          onCheckedChange={(v) => toggleInApp(event.key, v)}
                          aria-label={`${event.label} in AIMS`}
                        />
                      </TableCell>
                      {CHANNELS.map((c) => (
                        <TableCell key={c.key} className="text-center">
                          <Switch
                            checked={pref[c.key]}
                            disabled={
                              !inAppOn ||
                              !channels.available[c.key] ||
                              (c.needsPhone && !channels.hasPhone)
                            }
                            onCheckedChange={(v) => toggleChannel(event.key, c.key, v)}
                            aria-label={`${event.label} by ${c.label}`}
                          />
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        {pref.muted && pref.mutedUntil ? (
                          <MutedBadge
                            until={pref.mutedUntil}
                            onUnmute={() => muteRow(event.key, null)}
                          />
                        ) : (
                          <MuteMenu
                            showUnmute={false}
                            onMute={(until) => muteRow(event.key, until)}
                            onUnmute={() => muteRow(event.key, null)}
                            trigger={
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={!inAppOn}
                                aria-label={`Mute ${event.label}`}
                              >
                                <BellOff className="mr-1 h-4 w-4" aria-hidden="true" />
                                Mute
                              </Button>
                            }
                          />
                        )}
                      </TableCell>
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
              onCheckedChange={toggleEmailDigest}
            />
          </div>
        </>
      )}
    </div>
  );
}
