import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "@/lib/account";
import { api, isDemo } from "@/lib/api";
import { mutateApi, perform } from "@/lib/workspace";
import { Card } from "./kit";
import { Button } from "./ui/button";

type Leave = { id: string; start: string; end: string; note: string | null };
export function LeaveSettings() {
  const { account } = useAccount();
  const client = useQueryClient();
  const enabled = !isDemo && account?.role !== "system_admin";
  const query = useQuery({
    queryKey: ["my-leave", account?.id],
    queryFn: () => api<Leave[]>("/leave"),
    enabled,
  });
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (!enabled) return null;
  return (
    <Card className="mt-6">
      <h2 className="font-display text-lg font-semibold">My leave</h2>
      <p className="my-3 text-sm text-muted-foreground">
        Record your leave dates. Overlapping dates are included in your weekly and monthly reports.
      </p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          const saved = await perform(async () => {
            await mutateApi("/leave", {
              method: "POST",
              body: JSON.stringify({ start, end, note }),
            });
            await client.invalidateQueries({ queryKey: ["my-leave"] });
          }, "Leave recorded");
          if (saved) {
            setStart("");
            setEnd("");
            setNote("");
          }
          setBusy(false);
        }}
      >
        <label className="field-label">
          From
          <input
            type="date"
            className="field-input"
            required
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <label className="field-label">
          To
          <input
            type="date"
            className="field-input"
            required
            min={start}
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
        <label className="field-label flex-1">
          Note (optional)
          <input
            className="field-input"
            maxLength={1000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <Button disabled={busy}>Record leave</Button>
      </form>
      {query.error && <p role="alert">{query.error.message}</p>}
      <div className="mt-4 divide-y">
        {query.data?.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <p>
              {row.start} to {row.end}
              {row.note ? ` | ${row.note}` : ""}
            </p>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await perform(async () => {
                  await mutateApi(`/leave/${row.id}`, { method: "DELETE" });
                  await client.invalidateQueries({ queryKey: ["my-leave"] });
                }, "Leave record removed");
                setBusy(false);
              }}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
