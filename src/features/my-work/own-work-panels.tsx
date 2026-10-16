import { useAuth, type AppRole } from "@/lib/auth";
import { MyWorkPanel } from "./my-work-panel";
import { StartHerePanel } from "@/features/start-here/start-here-panel";

/** "Start here" and "My work" for a department's own staff; hidden for visitors from elsewhere. */
export function OwnWorkPanels({ departmentCode, role }: { departmentCode: string; role: AppRole }) {
  const { hasRole } = useAuth();
  if (!hasRole(role)) return null;
  return (
    <>
      <StartHerePanel departmentCode={departmentCode} />
      <MyWorkPanel departmentCode={departmentCode} />
    </>
  );
}
