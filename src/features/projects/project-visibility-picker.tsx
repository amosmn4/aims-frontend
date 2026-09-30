import { useId, useState } from "react";
import { Loader2 } from "lucide-react";
import { useProfilesLite } from "@/features/clients/use-clients-contracts";
import type { ProjectVisibility } from "@/features/projects/use-projects";
import { LoadError } from "@/components/load-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

// Department-wide vs only selected people. Picking people only adds access; removal happens on the Team tab.
export function ProjectVisibilityPicker({
  departmentName,
  visibility,
  onVisibilityChange,
  memberIds,
  onMemberIdsChange,
}: {
  departmentName: string;
  visibility: ProjectVisibility;
  onVisibilityChange: (v: ProjectVisibility) => void;
  memberIds: string[];
  onMemberIdsChange: (ids: string[]) => void;
}) {
  const profilesQ = useProfilesLite();
  const [search, setSearch] = useState("");
  const headingId = useId();

  const toggle = (id: string) => {
    onMemberIdsChange(
      memberIds.includes(id) ? memberIds.filter((x) => x !== id) : [...memberIds, id],
    );
  };

  const people = profilesQ.data ?? [];
  const needle = search.trim().toLowerCase();
  const shown = needle
    ? people.filter(
        (p) =>
          (p.full_name ?? "").toLowerCase().includes(needle) ||
          p.email.toLowerCase().includes(needle),
      )
    : people;

  return (
    <div className="space-y-2">
      <p id={headingId} className="text-sm font-medium">
        Who can view this project
      </p>
      <RadioGroup
        aria-labelledby={headingId}
        value={visibility}
        onValueChange={(v) => onVisibilityChange(v as ProjectVisibility)}
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="department" id="vis-department" />
          <Label htmlFor="vis-department" className="font-normal cursor-pointer">
            Everyone in {departmentName || "the department"}
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="restricted" id="vis-restricted" />
          <Label htmlFor="vis-restricted" className="font-normal cursor-pointer">
            Only selected people
          </Label>
        </div>
      </RadioGroup>

      {visibility === "restricted" &&
        (profilesQ.isLoading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading staff…
          </p>
        ) : profilesQ.isError ? (
          <LoadError
            what="staff"
            error={profilesQ.error}
            onRetry={() => profilesQ.refetch()}
            className="p-3"
          />
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Whoever created the project always has access. {memberIds.length} selected.
            </p>
            {people.length > 8 && (
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff"
                aria-label="Search staff"
                className="h-8"
              />
            )}
            <ScrollArea className="max-h-40 rounded border p-2">
              <div className="space-y-2">
                {people.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No staff found.</p>
                ) : shown.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No staff match "{search.trim()}".{" "}
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={() => setSearch("")}
                    >
                      Clear search
                    </button>
                  </p>
                ) : (
                  shown.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        id={`vis-member-${p.id}`}
                        checked={memberIds.includes(p.id)}
                        onCheckedChange={() => toggle(p.id)}
                      />
                      <Label htmlFor={`vis-member-${p.id}`} className="font-normal cursor-pointer">
                        {p.full_name ?? p.email}
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        ))}
    </div>
  );
}
