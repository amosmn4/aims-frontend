import { useState, type ReactNode } from "react";
import { BellRing, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate } from "@/lib/format-date";
import { muteUntilDateIso, muteUntilIso } from "@/features/settings/use-alert-channels";

const ITEM =
  "w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none";

/** Picks how long to pause alerts: a day, a week, or up to a chosen date. */
export function MuteMenu({
  trigger,
  onMute,
  onUnmute,
  showUnmute,
  unmuteLabel = "Turn alerts back on",
  verb = "Mute",
  align = "end",
}: {
  trigger: ReactNode;
  onMute: (mutedUntil: string) => void;
  onUnmute: () => void;
  showUnmute: boolean;
  unmuteLabel?: string;
  verb?: string;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [pickingDate, setPickingDate] = useState(false);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const close = () => {
    setOpen(false);
    setPickingDate(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPickingDate(false);
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className={pickingDate ? "w-auto p-0" : "w-60 p-1"}>
        {pickingDate ? (
          <Calendar
            mode="single"
            autoFocus
            defaultMonth={tomorrow}
            disabled={{ before: tomorrow }}
            onSelect={(day) => {
              if (!day) return;
              onMute(muteUntilDateIso(day));
              close();
            }}
          />
        ) : (
          <div className="grid gap-0.5">
            <button
              type="button"
              className={ITEM}
              onClick={() => {
                onMute(muteUntilIso(1));
                close();
              }}
            >
              {verb} for 1 day
            </button>
            <button
              type="button"
              className={ITEM}
              onClick={() => {
                onMute(muteUntilIso(7));
                close();
              }}
            >
              {verb} for 1 week
            </button>
            <button type="button" className={ITEM} onClick={() => setPickingDate(true)}>
              <CalendarDays className="mr-2 inline h-4 w-4 align-text-bottom" aria-hidden="true" />
              {verb} until a date…
            </button>
            {showUnmute && (
              <button
                type="button"
                className={`${ITEM} text-primary`}
                onClick={() => {
                  onUnmute();
                  close();
                }}
              >
                <BellRing className="mr-2 inline h-4 w-4 align-text-bottom" aria-hidden="true" />
                {unmuteLabel}
              </button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Shows the date a pause ends, with one click to end it now. */
export function MutedBadge({
  until,
  onUnmute,
  what = "Muted",
}: {
  until: string;
  onUnmute: () => void;
  what?: string;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge variant="secondary" className="font-normal">
        {what} until {formatDate(until)}
      </Badge>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto p-0 text-xs"
        onClick={onUnmute}
      >
        Turn back on
      </Button>
    </span>
  );
}
