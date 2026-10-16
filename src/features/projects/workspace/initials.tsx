import { cn } from "@/lib/utils";

const TONES = [
  "bg-primary text-primary-foreground",
  "bg-success text-success-foreground",
  "bg-accent text-accent-foreground",
  "bg-foreground text-background",
];

/** A round avatar with someone's initials, coloured consistently per name. */
export function Initials({ name, className }: { name: string; className?: string }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  const tone = TONES[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % TONES.length];
  return (
    <span
      className={cn(
        "inline-grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
        tone,
        className,
      )}
      title={name}
      aria-hidden="true"
    >
      {letters || "?"}
    </span>
  );
}
