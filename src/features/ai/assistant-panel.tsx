import { useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { plainAiText } from "./plain-ai-text";

export interface AiEvidence {
  queriedAt?: string;
  sources?: {
    model: string;
    matchedRecords: number;
    coverage?: unknown;
    filters?: unknown;
    records: { id: string; label: string; href: string | null }[];
  }[];
}
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  evidence?: AiEvidence | null;
}

const SOURCE_NAMES: Record<string, string> = {
  WaterUsageRecord: "Water payments",
  WaterMeterReading: "Meter and household readings",
  WaterMeterUsageInterval: "Measured usage periods",
  WaterCustomer: "Water customers",
  WaterMeter: "Water meters",
  Expense: "Expenses",
  InvoicePayment: "Invoice payments",
};
const sourceName = (name: string) => SOURCE_NAMES[name] || name.replace(/([a-z])([A-Z])/g, "$1 $2");

function coverageLabel(value: unknown): string {
  if (value && typeof value === "object" && "month" in value)
    return `Report month: ${String(value.month)}`;
  const dates: string[] = [];
  const visit = (item: unknown) => {
    if (typeof item === "string" && /^\d{4}-\d{2}-\d{2}T/.test(item)) dates.push(item);
    else if (item && typeof item === "object") Object.values(item).forEach(visit);
  };
  visit(value);
  dates.sort();
  const format = (date: string) =>
    new Date(date).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "Africa/Nairobi",
    });
  return dates.length
    ? `Recorded dates: ${format(dates[0])} to ${format(dates[dates.length - 1])}`
    : "No dated records in this result.";
}

export function AiSources({ evidence }: { evidence?: AiEvidence | null }) {
  if (!evidence?.sources?.length) return null;
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer font-medium">
        Records checked ({evidence.sources.length} queries)
      </summary>
      <div className="mt-2 space-y-3">
        {evidence.sources.map((source, index) => (
          <div key={index}>
            <p>
              {sourceName(source.model)}: {source.matchedRecords.toLocaleString()} matching records
            </p>
            {source.coverage != null && (
              <p className="break-words text-muted-foreground">{coverageLabel(source.coverage)}</p>
            )}
            {source.filters != null && (
              <p className="break-words text-muted-foreground">
                {typeof source.filters === "object" &&
                source.filters &&
                Object.keys(source.filters).length
                  ? "Search restricted to the requested records or dates."
                  : "Search covers all stored history."}
              </p>
            )}
            <div className="mt-1 flex flex-wrap gap-2">
              {source.records.slice(0, 10).map((record) =>
                record.href ? (
                  <a key={record.id} href={record.href} className="text-primary underline">
                    {plainAiText(record.label)}
                  </a>
                ) : (
                  <span key={record.id}>{plainAiText(record.label)}</span>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

export function AssistantPanel({
  context = "system",
  title = "Ask AIMS",
  suggestedQuestion,
}: {
  context?: string;
  title?: string;
  suggestedQuestion?: string;
}) {
  const [draft, setDraft] = useState("");
  const [failure, setFailure] = useState("");
  const client = useQueryClient();
  const { viewAs } = useAuth();
  const status = useQuery({
    queryKey: ["ai", "status"],
    queryFn: () => apiJson<{ configured: boolean }>("/ai/status"),
    staleTime: 60000,
  });
  const history = useInfiniteQuery({
    queryKey: ["ai", "chat", context],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiJson<{ rows: Message[]; nextPage: number | null }>(
        `/ai/chat?context=${encodeURIComponent(context)}&page=${pageParam}`,
      ),
    getNextPageParam: (last) => last.nextPage ?? undefined,
    enabled: status.data?.configured === true,
  });
  const send = useMutation({
    mutationFn: (message: string) =>
      apiJson<Message>("/ai/chat", { method: "POST", body: JSON.stringify({ message, context }) }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["ai", "chat", context] });
      setDraft("");
      setFailure("");
    },
    onError: (error) =>
      setFailure(error instanceof Error ? error.message : "Could not retrieve the records."),
  });
  const messages = [...(history.data?.pages ?? [])].reverse().flatMap((page) => page.rows);
  const submit = (value: string) => {
    if (value.trim() && !send.isPending && !viewAs && status.data?.configured)
      send.mutate(value.trim());
  };
  return (
    <section className="space-y-3" aria-label={title}>
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask about records across AIMS. General questions search all stored dates. Report questions
          use the report period unless you request another range.
        </p>
      </div>
      {status.isError && (
        <p role="alert" className="text-sm text-destructive">
          Could not check the assistant connection.
        </p>
      )}
      {status.data && !status.data.configured && (
        <p role="status" className="text-sm">
          Connect OpenAI on the backend to query your records.
        </p>
      )}
      {viewAs && (
        <p className="text-sm text-muted-foreground">
          Asking new questions is unavailable in View As.
        </p>
      )}
      {suggestedQuestion && (
        <Button
          variant="outline"
          onClick={() => submit(suggestedQuestion)}
          disabled={send.isPending || !!viewAs || !status.data?.configured}
        >
          Explain this report
        </Button>
      )}
      <div
        className="max-h-[50vh] min-h-36 space-y-3 overflow-y-auto rounded-lg border bg-background p-3"
        aria-live="polite"
      >
        {history.hasNextPage && (
          <Button
            size="sm"
            variant="outline"
            disabled={history.isFetchingNextPage}
            onClick={() => history.fetchNextPage()}
          >
            Load older messages
          </Button>
        )}
        {history.isLoading && (
          <p className="text-sm text-muted-foreground">Loading conversation...</p>
        )}
        {history.isError && (
          <p role="alert" className="text-sm text-destructive">
            Could not load the conversation.
          </p>
        )}
        {!messages.length && !history.isLoading && (
          <p className="text-sm text-muted-foreground">
            Try “Show payments across every recorded year” or ask about a meter, expense, project,
            or report.
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`rounded-md p-3 text-sm ${message.role === "user" ? "bg-secondary" : "border"}`}
          >
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              {message.role === "user" ? "You" : "AIMS"}
            </p>
            <p className="whitespace-pre-wrap break-words leading-relaxed">
              {message.role === "assistant" ? plainAiText(message.content) : message.content}
            </p>
            <AiSources evidence={message.evidence} />
          </div>
        ))}
        {send.isPending && (
          <p role="status" className="text-sm text-muted-foreground">
            Checking matching records and related history...
          </p>
        )}
      </div>
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(draft);
        }}
        className="space-y-2"
      >
        <Textarea
          aria-label="Question for AIMS"
          value={draft}
          maxLength={4000}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask about any business records or date range"
          disabled={send.isPending || !!viewAs || !status.data?.configured}
        />
        <Button
          type="submit"
          disabled={!draft.trim() || send.isPending || !!viewAs || !status.data?.configured}
        >
          {send.isPending ? "Checking records..." : "Ask AIMS"}
        </Button>
      </form>
    </section>
  );
}

export function AssistantLauncher() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Ask AIMS"
          className="shrink-0 px-2 text-inherit hover:bg-white/10 hover:text-inherit sm:px-3"
        >
          <span className="sm:hidden">AI</span>
          <span className="hidden sm:inline">Ask AIMS</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[95dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>AIMS assistant</DialogTitle>
          <DialogDescription>Answers from the records your account can access.</DialogDescription>
        </DialogHeader>
        {open && <AssistantPanel />}
      </DialogContent>
    </Dialog>
  );
}
