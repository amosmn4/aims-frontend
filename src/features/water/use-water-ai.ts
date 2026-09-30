import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

/* ---------- Status ---------- */

export interface WaterAiStatus {
  configured: boolean;
  providers: { openai: boolean; gemini: boolean };
}

export function useWaterAiStatus() {
  return useQuery({
    queryKey: ["water", "ai", "status"],
    queryFn: () => apiJson<WaterAiStatus>("/water/ai/status"),
  });
}

/* ---------- Insights panel ---------- */

export type WaterAiSeverity = "low" | "medium" | "high";

export interface WaterAiAnomaly {
  title: string;
  detail: string;
  severity: WaterAiSeverity;
}

export interface WaterAiInsight {
  id: string;
  month: string;
  summary: string;
  anomalies: WaterAiAnomaly[];
  reasons: string[];
  provider: "openai" | "gemini";
  generated_at: string;
}

type BackendInsight = {
  id: string;
  month: string;
  summary: string;
  anomalies: WaterAiAnomaly[];
  reasons: string[];
  provider: "openai" | "gemini";
  createdAt: string;
};

function mapInsight(raw: BackendInsight): WaterAiInsight {
  return {
    id: raw.id,
    month: raw.month,
    summary: raw.summary,
    anomalies: raw.anomalies ?? [],
    reasons: raw.reasons ?? [],
    provider: raw.provider,
    generated_at: raw.createdAt,
  };
}

export function useWaterAiInsight(month?: string) {
  return useQuery({
    queryKey: ["water", "ai", "insights", month],
    queryFn: async () => {
      const qs = month ? `?month=${encodeURIComponent(month)}` : "";
      const raw = await apiJson<BackendInsight | null>(`/water/ai/insights${qs}`);
      return raw ? mapInsight(raw) : null;
    },
  });
}

export function useGenerateWaterAiInsight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (month: string | undefined) =>
      mapInsight(
        await apiJson<BackendInsight>("/water/ai/insights/generate", {
          method: "POST",
          body: JSON.stringify({ month }),
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water", "ai", "insights"] }),
  });
}

/* ---------- Chat ---------- */

export interface WaterAiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

type BackendChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

function mapChatMessage(raw: BackendChatMessage): WaterAiChatMessage {
  return { id: raw.id, role: raw.role, content: raw.content, created_at: raw.createdAt };
}

export function useWaterAiChatHistory() {
  return useQuery({
    queryKey: ["water", "ai", "chat"],
    queryFn: async () => {
      const raw = await apiJson<BackendChatMessage[]>("/water/ai/chat");
      return raw.map(mapChatMessage);
    },
  });
}

export function useSendWaterAiChatMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (message: string) =>
      mapChatMessage(
        await apiJson<BackendChatMessage>("/water/ai/chat", {
          method: "POST",
          body: JSON.stringify({ message }),
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water", "ai", "chat"] }),
  });
}

export function useClearWaterAiChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiJson("/water/ai/chat", { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water", "ai", "chat"] }),
  });
}
