import { createContext, useContext, useState, type ReactNode } from "react";
import { documents, projects, type Doc, type Project, type Report } from "./data";
import { useAccount } from "./account";
import { reviewReport, saveRecord, useWorkspace } from "./workspace";

export type ViewMode = "ceo" | "department" | "staff";
export const personas: { mode: ViewMode; personId: string; label: string }[] = [
  { mode: "ceo", personId: "p1", label: "CEO view" },
  { mode: "department", personId: "p4", label: "My department view" },
  { mode: "staff", personId: "p4", label: "Staff view" },
];
type Ctx = {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  me: ReturnType<ReturnType<typeof useWorkspace>["person"]>;
  reports: Report[];
  addReport: (report: Report) => void | Promise<void>;
  review: (id: string, comment?: string) => Promise<void>;
};
const RoleCtx = createContext<Ctx | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { account } = useAccount();
  const { person, reports, people } = useWorkspace();
  const me = person(account?.personId ?? people[0]?.id ?? "");
  const [view, setView] = useState<"staff" | "department">(() => {
    try {
      return localStorage.getItem("amsol-staff-view") === "department" ? "department" : "staff";
    } catch {
      return "staff";
    }
  });
  const mode = account?.role === "ceo" ? "ceo" : view;
  const setMode = (value: ViewMode) => {
    if (value === "ceo") return;
    setView(value);
    localStorage.setItem("amsol-staff-view", value);
  };
  return (
    <RoleCtx.Provider
      value={{
        mode,
        setMode,
        me,
        reports,
        addReport: (report) => saveRecord("reports", report),
        review: reviewReport,
      }}
    >
      {children}
    </RoleCtx.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleCtx);
  if (!context) throw new Error("RoleProvider is required");
  return context;
}

export function canViewDepartments(mode: ViewMode) {
  return mode === "ceo";
}
export function myProjects(
  mode: ViewMode,
  meId: string,
  dept: string | null,
  list: Project[] = projects,
  managedBusinesses: string[] = [],
) {
  if (mode === "ceo") return list;
  if (mode === "department")
    return list.filter((project) => dept && project.depts.includes(dept as never));
  return list.filter(
    (project) =>
      project.members.includes(meId) || managedBusinesses.includes(project.business ?? "b0"),
  );
}
export function deptOtherProjects(meId: string, dept: string | null, list: Project[] = projects) {
  return list.filter(
    (project) => dept && project.depts.includes(dept as never) && !project.members.includes(meId),
  );
}
export function canOpenDoc(
  doc: Doc,
  mode: ViewMode,
  meId: string,
  dept: string | null,
  list: Project[] = projects,
) {
  if (mode === "ceo" || doc.owner === meId) return true;
  if (doc.access === "public") return true;
  if (doc.access === "department") return doc.dept === dept;
  if (doc.access === "project")
    return !!list.find((project) => project.id === doc.project)?.members.includes(meId);
  return !!doc.allowed?.includes(meId);
}
export const allDocs = documents;
