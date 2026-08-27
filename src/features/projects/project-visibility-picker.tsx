import { useProfilesLite } from "@/features/clients/use-clients-contracts";
import type { ProjectVisibility } from "@/features/projects/use-projects";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

// Mirrors DocumentAccessDialog's two-mode structure (frontend/src/features/documents/
// document-access-picker.tsx) but for Projects: "department" (today's default — everyone in the
// owning department sees it) vs "restricted" (only the creator + explicitly picked people).
// Additive only — picking people here grants access; it never revokes anyone already on the
// Team tab, so removing someone's access stays a deliberate action there.
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

  const toggle = (id: string) => {
    onMemberIdsChange(
      memberIds.includes(id) ? memberIds.filter((x) => x !== id) : [...memberIds, id],
    );
  };

  return (
    <div className="space-y-2">
      <Label>Who can see this project</Label>
      <RadioGroup
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

      {visibility === "restricted" && (
        <ScrollArea className="max-h-40 rounded border p-2">
          <div className="space-y-2">
            {(profilesQ.data ?? []).map((p) => (
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
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
