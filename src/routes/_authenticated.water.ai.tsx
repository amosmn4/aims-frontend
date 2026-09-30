import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bot,
  Loader2,
  PlugZap,
  RefreshCw,
  Send,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import {
  useWaterAiStatus,
  useWaterAiInsight,
  useGenerateWaterAiInsight,
  useWaterAiChatHistory,
  useSendWaterAiChatMessage,
  useClearWaterAiChat,
  type WaterAiSeverity,
  type WaterAiChatMessage,
} from "@/features/water/use-water-ai";
import { formatPeriodKey } from "@/features/water/water-ui";
import { PageHeader } from "@/components/app-shell";
import { confirmDialog } from "@/components/confirm-dialog";
import { LoadError } from "@/components/load-error";
import { formatDateTime } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/water/ai")({
  head: () => ({ meta: [{ title: "Water Project — AI Insights — AIMS" }] }),
  component: WaterAiPage,
});

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function errMsg(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

const SEVERITY_STYLES: Record<WaterAiSeverity, string> = {
  low: "bg-secondary text-secondary-foreground",
  medium: "bg-warning text-warning-foreground",
  high: "bg-destructive text-destructive-foreground",
};

const SEVERITY_LABELS: Record<WaterAiSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const PAGE_DESCRIPTION =
  "Plain-language summaries of this month's water figures, unusual changes, and an assistant you can ask about the network.";

function WaterAiPage() {
  const statusQ = useWaterAiStatus();

  if (statusQ.isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (statusQ.isError) {
    return (
      <div className="space-y-4">
        <PageHeader title="AI Insights" description={PAGE_DESCRIPTION} />
        <LoadError what="AI Insights" error={statusQ.error} onRetry={() => statusQ.refetch()} />
      </div>
    );
  }

  if (!statusQ.data?.configured) {
    return (
      <div className="space-y-4">
        <PageHeader title="AI Insights" description={PAGE_DESCRIPTION} />
        <div className="rounded-lg border border-dashed bg-card py-14 px-4 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <PlugZap className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="text-sm font-semibold">AI Insights isn&apos;t switched on yet</div>
          <p className="mt-1.5 max-w-md mx-auto text-xs text-muted-foreground">
            An AI provider (OpenAI or Gemini) needs to be connected before summaries and the
            assistant work. Ask IT to connect one. The rest of the Water Project works without it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="AI Insights" description={PAGE_DESCRIPTION} />
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
        Connected to {statusQ.data.providers.openai ? "OpenAI" : "Gemini"}
        {statusQ.data.providers.openai && statusQ.data.providers.gemini
          ? " (Gemini ready as a backup)"
          : ""}
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-start">
        <div className="xl:col-span-2">
          <InsightsPanel />
        </div>
        <div className="xl:col-span-3">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}

function InsightsPanel() {
  const [month, setMonth] = useState(currentMonth());
  const insightQ = useWaterAiInsight(month);
  const generate = useGenerateWaterAiInsight();

  const runGenerate = () => {
    generate.mutate(month, {
      onError: (err) => toast.error(errMsg(err, "Couldn't generate insights")),
    });
  };

  const insight = insightQ.data;
  const monthLabel = formatPeriodKey(month);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Label htmlFor="ai-month" className="text-xs">
            Month
          </Label>
          <Input
            id="ai-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-9 w-40"
          />
        </div>
        <Button size="sm" onClick={runGenerate} disabled={generate.isPending || !month}>
          {generate.isPending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1.5" />
          )}
          {insight ? "Refresh insights" : "Generate insights"}
        </Button>
      </div>

      {insightQ.isLoading ? (
        <div className="py-10 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : insightQ.isError ? (
        <LoadError what="insights" error={insightQ.error} onRetry={() => insightQ.refetch()} />
      ) : !insight ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed py-10 px-4 text-center text-xs text-muted-foreground">
          <span>No insights for {monthLabel} yet</span>
          <Button size="sm" variant="outline" onClick={runGenerate} disabled={generate.isPending}>
            <Sparkles className="h-4 w-4 mr-1" /> Generate insights
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed">{insight.summary}</p>

          {insight.anomalies.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">
                Unusual changes
              </div>
              <div className="space-y-2">
                {insight.anomalies.map((a, i) => (
                  <div key={i} className="rounded-md border p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium flex items-center gap-1.5">
                        <AlertTriangle
                          className="h-3.5 w-3.5 text-muted-foreground shrink-0"
                          aria-hidden="true"
                        />
                        {a.title}
                      </div>
                      <Badge className={cn("text-[10px] shrink-0", SEVERITY_STYLES[a.severity])}>
                        {SEVERITY_LABELS[a.severity]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{a.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {insight.reasons.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">Likely reasons</div>
              <ul className="space-y-1.5">
                {insight.reasons.map((r, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                    <span className="text-muted-foreground/60" aria-hidden="true">
                      —
                    </span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-xs text-muted-foreground pt-1 border-t">
            Generated {formatDateTime(insight.generated_at)} using{" "}
            {insight.provider === "openai" ? "OpenAI" : "Gemini"}
          </div>
        </div>
      )}
    </div>
  );
}

const SUGGESTED_PROMPTS = [
  "Which zone is losing the most water this month?",
  "How has non-revenue water trended over the last 6 months?",
  "What's driving the tank-to-distribution loss?",
];

function ChatPanel() {
  const historyQ = useWaterAiChatHistory();
  const send = useSendWaterAiChatMessage();
  const clear = useClearWaterAiChat();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = historyQ.data ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, send.isPending]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || send.isPending) return;
    setDraft("");
    send.mutate(trimmed, {
      onError: (err) => {
        setDraft(trimmed);
        toast.error(errMsg(err, "Couldn't send that message"));
      },
    });
  };

  const runClear = async () => {
    const ok = await confirmDialog({
      title: "Start a new conversation?",
      description:
        "This clears the current conversation with the water assistant. It can't be undone.",
      confirmLabel: "Clear conversation",
      destructive: true,
    });
    if (!ok) return;
    clear.mutate(undefined, {
      onError: (err) => toast.error(errMsg(err, "Couldn't clear the conversation")),
    });
  };

  return (
    <div className="rounded-lg border bg-card flex flex-col h-140">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="text-sm font-semibold flex items-center gap-1.5">
          <Bot className="h-4 w-4 text-primary" aria-hidden="true" /> Ask the water assistant
        </div>
        {messages.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={runClear}
            disabled={clear.isPending}
            className="h-7 text-xs text-muted-foreground"
          >
            New conversation
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {historyQ.isLoading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : historyQ.isError ? (
          <LoadError
            what="the conversation"
            error={historyQ.error}
            onRetry={() => historyQ.refetch()}
          />
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
              <Bot className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-xs text-muted-foreground max-w-xs">
              Ask about trends, losses or a particular zone. The assistant reads the latest
              dashboard, trend and zone-loss figures before answering. Try one of these:
            </p>
            <div className="flex flex-col gap-1.5 w-full max-w-sm">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => submit(p)}
                  disabled={send.isPending}
                  className="text-xs text-left rounded-md border px-2.5 py-1.5 hover:bg-secondary/50 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <ChatBubble key={m.id} message={m} />
            ))}
            {send.isPending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary shrink-0">
                  <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="border-t p-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
      >
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(draft);
            }
          }}
          placeholder="Ask a question about the water network…"
          aria-label="Message to the water assistant"
          rows={1}
          className="min-h-9 max-h-32 resize-none text-sm"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!draft.trim() || send.isPending}
          className="h-9 w-9 shrink-0"
          aria-label="Send message to the water assistant"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function ChatBubble({ message }: { message: WaterAiChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex items-start gap-2", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full shrink-0",
          isUser ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
        )}
        aria-label={isUser ? "You" : "Water assistant"}
      >
        {isUser ? <UserIcon className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div
        className={cn(
          "rounded-lg px-3 py-2 text-sm max-w-[80%] whitespace-pre-wrap leading-relaxed",
          isUser ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
