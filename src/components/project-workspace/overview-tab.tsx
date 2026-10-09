import { toast } from "sonner";
import type { Project, SdlcStage } from "@/features/projects/use-projects";
import {
  useUpdateProject,
  SYSTEM_DEVELOPMENT_METHODOLOGY,
  SDLC_STAGES,
  SDLC_STAGE_LABELS,
} from "@/features/projects/use-projects";
import { StageTracker, SectionLabel } from "@/components/pipeline/detail-sheet";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function Explain({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1 text-xs" style={{ color: "var(--pipeline-slate)" }}>
      {children}
    </div>
  );
}

// IT only: which step of building a system this project is at.
export function SdlcPanel({ project, canManage }: { project: Project; canManage: boolean }) {
  const updateProject = useUpdateProject();
  const isSystemDevelopment = project.methodology === SYSTEM_DEVELOPMENT_METHODOLOGY;

  if (!isSystemDevelopment) {
    if (!canManage) return null;
    return (
      <div className="ws-panel">
        <h3>System development stages</h3>
        <Explain>
          For projects that build or change a system: track it through requirements, design,
          development, testing, deployment and maintenance.
        </Explain>
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          disabled={updateProject.isPending}
          onClick={() =>
            updateProject.mutate(
              {
                id: project.id,
                methodology: SYSTEM_DEVELOPMENT_METHODOLOGY,
                sdlcStage: "requirements",
              },
              {
                onSuccess: () => toast.success("Now tracking system development stages"),
                onError: (err) =>
                  toast.error(err instanceof Error ? err.message : "Failed to update"),
              },
            )
          }
        >
          Track system development stages
        </Button>
      </div>
    );
  }

  const stage = project.sdlc_stage ?? "requirements";
  const idx = SDLC_STAGES.indexOf(stage);

  return (
    <div className="ws-panel">
      <h3>System development stage (SDLC)</h3>
      <Explain>The step this system build is at, from requirements through to maintenance.</Explain>
      <SectionLabel>Stage progress</SectionLabel>
      <StageTracker total={SDLC_STAGES.length} doneCount={idx} currentIndex={idx} />
      {canManage ? (
        <>
          <label
            htmlFor={`sdlc-stage-${project.id}`}
            className="mt-1 block text-xs font-medium"
            style={{ color: "var(--pipeline-slate)" }}
          >
            Move to stage
          </label>
          <Select
            value={stage}
            onValueChange={(v) =>
              updateProject.mutate(
                { id: project.id, sdlcStage: v as SdlcStage },
                {
                  onError: (err) =>
                    toast.error(err instanceof Error ? err.message : "Failed to update"),
                },
              )
            }
          >
            <SelectTrigger id={`sdlc-stage-${project.id}`} className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SDLC_STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SDLC_STAGE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      ) : (
        <div className="text-sm">Current stage: {SDLC_STAGE_LABELS[stage]}</div>
      )}
    </div>
  );
}
