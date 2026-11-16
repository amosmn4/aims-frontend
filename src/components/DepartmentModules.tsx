import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card, Pill, fmtDate, SectionTitle } from "./kit";
import { Button } from "./ui/button";
import { ModuleForm } from "./WorkspaceForms";
import { EmptyState, RecordActions, SearchField } from "./RecordDialog";
import { useWorkspace } from "@/lib/workspace";
import type { DeptId } from "@/lib/data";
import type { ModuleRecord } from "@/lib/models";
import { useRole } from "@/lib/role";

export function DepartmentModules({ dept }: { dept: DeptId }) {
  const { me, mode } = useRole();
  const { departments, moduleRecords, person } = useWorkspace();
  const department = departments.find((department) => department.id === dept);
  const [selected, setSelected] = useState("");
  const [edit, setEdit] = useState<ModuleRecord | "new" | null>(null);
  const [search, setSearch] = useState("");
  if (!department) return null;
  const records = moduleRecords.filter(
    (record) =>
      record.dept === dept &&
      record.module === selected &&
      `${record.title} ${record.notes}`.toLowerCase().includes(search.toLowerCase()),
  );
  const links: Record<string, "/clients" | "/businesses" | "/client-requests"> = {
    "Client accounts": "/clients",
    "Sister companies": "/businesses",
    "Client requests": "/client-requests",
  };
  return (
    <div className="mb-8">
      <SectionTitle>Department modules</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-3">
        {department.modules.map((module) => (
          <Card key={module} className="p-4">
            {links[module] ? (
              <Link to={links[module]} className="font-medium text-primary underline">
                {module}
              </Link>
            ) : (
              <button
                onClick={() => {
                  setSelected(module);
                  setSearch("");
                }}
                aria-pressed={selected === module}
                className="w-full text-left"
              >
                <span className="font-medium">{module}</span>
                <span className="mt-2 block text-xs text-muted-foreground">
                  {
                    moduleRecords.filter(
                      (record) => record.dept === dept && record.module === module,
                    ).length
                  }{" "}
                  records
                </span>
              </button>
            )}
          </Card>
        ))}
      </div>
      {selected && (
        <section className="mt-5 rounded-xl border bg-muted/30 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold">{selected}</h3>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setEdit("new")}>
                Add record
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelected("")}>
                Close
              </Button>
            </div>
          </div>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={`Search ${selected.toLowerCase()}`}
          />
          {!records.length && <EmptyState>No records yet. Add the first record.</EmptyState>}
          <div className="space-y-3">
            {records
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((record) => (
                <Card key={record.id}>
                  <div className="flex justify-between gap-3">
                    <div>
                      <h4 className="font-medium">{record.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        {person(record.owner).name} | {fmtDate(record.date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill>{record.status}</Pill>
                      {(mode === "ceo" || record.owner === me.id) && (
                        <RecordActions
                          collection="moduleRecords"
                          id={record.id}
                          label={record.title}
                          onEdit={() => setEdit(record)}
                        />
                      )}
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm">{record.notes}</p>
                  {!!record.amount && (
                    <p className="mt-2 text-sm">KES {record.amount.toLocaleString()}</p>
                  )}
                </Card>
              ))}
          </div>
        </section>
      )}
      {edit && (
        <ModuleForm
          record={edit === "new" ? undefined : edit}
          dept={dept}
          module={selected}
          onClose={() => setEdit(null)}
        />
      )}
    </div>
  );
}
