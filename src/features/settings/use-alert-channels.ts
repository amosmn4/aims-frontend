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

export interface AlertChannelSettings {
  events: { key: AlertEventKey; label: string }[];
  available: ChannelChoice;
  hasPhone: boolean;
  preferences: Partial<Record<AlertEventKey, ChannelChoice>>;
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

export function useSetAlertChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { eventKey: AlertEventKey } & Partial<ChannelChoice>) =>
      apiJson<AlertChannelSettings>("/notifications/channels", {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<AlertChannelSettings>(KEY);
      if (previous) {
        const { eventKey, ...changes } = input;
        const current = previous.preferences[eventKey] ?? {
          email: false,
          sms: false,
          whatsapp: false,
        };
        qc.setQueryData<AlertChannelSettings>(KEY, {
          ...previous,
          preferences: { ...previous.preferences, [eventKey]: { ...current, ...changes } },
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
