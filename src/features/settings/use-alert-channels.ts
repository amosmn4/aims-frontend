import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export type AlertChannel = "email" | "sms" | "whatsapp";

export type AlertEventKey =
  | "taskUpdates"
  | "projectUpdates"
  | "financeAlerts"
  | "tenderAlerts"
  | "remindersMeetings"
  | "reports";

export type ChannelChoice = Record<AlertChannel, boolean>;

export interface AlertPreference extends ChannelChoice {
  /** Off means AIMS never raises this alert — no bell item, no email, no SMS. */
  inApp: boolean;
  /** Paused until this date, then it comes back on its own. */
  mutedUntil: string | null;
  muted: boolean;
}

export interface AlertChannelSettings {
  events: { key: AlertEventKey; label: string }[];
  available: ChannelChoice;
  hasPhone: boolean;
  preferences: Partial<Record<AlertEventKey, AlertPreference>>;
}

export const DEFAULT_ALERT_PREFERENCE: AlertPreference = {
  inApp: true,
  email: false,
  sms: false,
  whatsapp: false,
  mutedUntil: null,
  muted: false,
};

export const alertPreference = (
  settings: AlertChannelSettings | undefined,
  key: AlertEventKey,
): AlertPreference => settings?.preferences[key] ?? DEFAULT_ALERT_PREFERENCE;

/** The date a "1 day" or "1 week" pause ends, as the API's ISO string. */
export function muteUntilIso(days: number) {
  const until = new Date();
  until.setDate(until.getDate() + days);
  return until.toISOString();
}

/** A chosen day starts at midnight, so alerts start again that morning. */
export function muteUntilDateIso(day: Date) {
  const until = new Date(day);
  until.setHours(0, 0, 0, 0);
  return until.toISOString();
}

const KEY = ["notifications", "channels"] as const;

export function useAlertChannels() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiJson<AlertChannelSettings>("/notifications/channels"),
  });
}

/** Sends a test SMS to the person's own number so they can see SMS alerts arrive. */
export function useSendTestSms() {
  return useMutation({
    mutationFn: () =>
      apiJson<{ sent: boolean }>("/notifications/channels/test-sms", { method: "POST" }),
  });
}

export type SetAlertChannelInput = { eventKey: AlertEventKey } & Partial<ChannelChoice> & {
    inApp?: boolean;
    mutedUntil?: string | null;
  };

export function useSetAlertChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SetAlertChannelInput) =>
      apiJson<AlertChannelSettings>("/notifications/channels", {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<AlertChannelSettings>(KEY);
      if (previous) {
        const { eventKey, ...changes } = input;
        const current = alertPreference(previous, eventKey);
        const next: AlertPreference = { ...current, ...changes };
        if (changes.mutedUntil !== undefined) {
          next.muted = !!changes.mutedUntil && new Date(changes.mutedUntil) > new Date();
        }
        qc.setQueryData<AlertChannelSettings>(KEY, {
          ...previous,
          preferences: { ...previous.preferences, [eventKey]: next },
        });
      }
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) qc.setQueryData(KEY, context.previous);
    },
    onSuccess: (data) => qc.setQueryData(KEY, data),
  });
}

/** Pauses every kind of alert at once, or turns them all back on with null. */
export function useMuteAllAlerts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mutedUntil: string | null) =>
      apiJson<AlertChannelSettings>("/notifications/channels/mute-all", {
        method: "PUT",
        body: JSON.stringify({ mutedUntil }),
      }),
    onSuccess: (data) => qc.setQueryData(KEY, data),
  });
}
