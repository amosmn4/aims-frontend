import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Card, PageHeader, Pill } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { RecordActions, RecordDialog } from "@/components/RecordDialog";
import { personSchema, type Workspace } from "@/lib/models";
import { mutateApi, perform, saveRecord, updateWorkspace, useWorkspace } from "@/lib/workspace";
import { isDemo } from "@/lib/api";
import { useRole } from "@/lib/role";
import { useAccount } from "@/lib/account";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>): { tab?: "Module access" } =>
    search["tab"] === "Module access" ? { tab: "Module access" } : {},
  head: () => ({
    meta: meta("Settings", "Manage staff accounts, business permissions and workspace settings."),
  }),
  component: Admin,
});
type Department = Workspace["departments"][number];
type Template = Workspace["templates"][number];
function Admin() {
  const { mode } = useRole();
  const { account: me } = useAccount();
  const { people, accounts, departments, deptName, settings, templates } = useWorkspace();
  const { tab: requestedTab } = Route.useSearch();
  const [tab, setTab] = useState(requestedTab ?? "Accounts");
  const [invite, setInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [department, setDepartment] = useState<Department | "new" | null>(null);
  const [template, setTemplate] = useState<Template | "new" | null>(null);
  if (mode !== "ceo") return <Card>Settings are available to the CEO.</Card>;
  const issueInvitation = async (id: string) => {
    if (id === me?.id) throw new Error("Use My account to change your own password.");
    if (!isDemo) {
      const result = await mutateApi<{ invitationUrl: string; emailSent: boolean }>(
        `/accounts/${encodeURIComponent(id)}/invitation`,
        { method: "POST" },
      );
      setInviteLink(result.invitationUrl);
      if (!result.emailSent) toast.info("Share the invitation link. Email was not delivered.");
      return;
    }
    const token = crypto.randomUUID();
    await updateWorkspace((previous) => ({
      ...previous,
      accounts: previous.accounts.map((account) =>
        account.id === id
          ? {
              ...account,
              passwordHash: "",
              invitation: token,
              invitationExpires: Date.now() + 7 * 86400000,
              active: true,
            }
          : account,
      ),
    }));
    setInviteLink(`${window.location.origin}/login?token=${token}`);
  };
  const selectedTemplate = template === "new" ? undefined : (template ?? undefined);
  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Staff accounts, roles and workspace settings"
        action={<Button onClick={() => setInvite(true)}>Invite staff</Button>}
      />
      <div className="mb-6 flex flex-wrap gap-2">
        {[
          "Accounts",
          "Module access",
          "Business access",
          "Departments",
          "Report templates",
          "Document rules",
          "Report reminders",
        ].map((value) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            aria-pressed={tab === value}
            className={`rounded-lg px-3 py-2 text-sm ${tab === value ? "bg-foreground text-background" : "bg-muted"}`}
          >
            {value}
          </button>
        ))}
      </div>
      {tab === "Module access" && <ModuleAccessSettings />}
      {inviteLink && (
        <Card className="mb-6">
          <h2 className="font-medium">Invitation link</h2>
          <p className="my-2 text-sm text-muted-foreground">
            Valid for 7 days. Share it with the intended staff member to set up their account.
            Password changes also apply to their shared AIMS identity.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              aria-label="Invitation link"
              className="field-input min-w-0 flex-1"
              readOnly
              value={inviteLink}
              onFocus={(event) => event.target.select()}
            />
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(inviteLink);
                  toast.success("Invitation link copied");
                } catch {
                  toast.error("Select the link and copy it manually.");
                }
              }}
            >
              Copy link
            </Button>
            <Button variant="ghost" onClick={() => setInviteLink("")}>
              Dismiss
            </Button>
          </div>
        </Card>
      )}
      {tab === "Accounts" && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase text-muted-foreground">
              <tr>
                {["Name", "Email", "Department", "Role", "Status", "Actions"].map((label) => (
                  <th key={label} className="px-4 py-3">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {accounts
                .filter((account) => account.role !== "system_admin")
                .map((account) => {
                  const person = people.find((person) => person.id === account.personId)!;
                  return (
                    <tr key={account.id}>
                      <td className="px-4 py-3">{person.name}</td>
                      <td className="px-4 py-3">{account.email}</td>
                      <td className="px-4 py-3">
                        {person.dept ? deptName(person.dept) : "Executive"}
                      </td>
                      <td className="px-4 py-3">
                        {account.role === "system_admin"
                          ? "System administrator"
                          : account.role === "ceo"
                            ? "CEO"
                            : "Staff"}
                      </td>
                      <td className="px-4 py-3">
                        <Pill>
                          {!account.active
                            ? "Inactive"
                            : (account.hasPassword ?? !!account.passwordHash)
                              ? "Active"
                              : "Invited"}
                        </Pill>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              perform(() =>
                                saveRecord("accounts", { ...account, active: !account.active }),
                              )
                            }
                          >
                            {account.active ? "Deactivate" : "Activate"}
                          </Button>
                          {account.id !== me?.id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                perform(
                                  () => issueInvitation(account.id),
                                  "New activation link created",
                                )
                              }
                            >
                              {(account.hasPassword ?? !!account.passwordHash)
                                ? "Reset access"
                                : "Renew invitation"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </Card>
      )}
      {tab === "Business access" && <BusinessPermissions />}
      {tab === "Departments" && (
        <>
          <div className="mb-4 flex justify-end">
            <Button onClick={() => setDepartment("new")}>Add department</Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {departments.map((item) => (
              <Card key={item.id}>
                <div className="flex justify-between gap-3">
                  <h2 className="font-display text-lg font-semibold">{item.name}</h2>
                  <Button size="sm" variant="outline" onClick={() => setDepartment(item)}>
                    Edit
                  </Button>
                </div>
                <p className="my-3 text-sm text-muted-foreground">{item.blurb}</p>
                <Link
                  to="/departments/$id"
                  params={{ id: item.id }}
                  className="text-sm text-primary underline"
                >
                  Open department
                </Link>
              </Card>
            ))}
          </div>
        </>
      )}
      {tab === "Report templates" && (
        <div className="space-y-4">
          <Button onClick={() => setTemplate("new")}>Add template</Button>
          {templates.map((item) => (
            <Card key={item.id}>
              <div className="flex justify-between gap-3">
                <div>
                  <h2 className="font-medium">{item.name}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.progress} | {item.blockers} | {item.next}
                  </p>
                </div>
                <RecordActions
                  collection="templates"
                  id={item.id}
                  label={item.name}
                  onEdit={() => setTemplate(item)}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
      {tab === "Document rules" && (
        <Card>
          <h2 className="font-display text-lg font-semibold">Default document access</h2>
          <p className="my-3 text-sm text-muted-foreground">
            This applies to new uploads. Existing file permissions are managed in Documents.
          </p>
          <select
            aria-label="Default document access"
            className="field-input mb-4 max-w-xs"
            value={settings.defaultDocumentAccess}
            onChange={(event) =>
              perform(() =>
                updateWorkspace((previous) => ({
                  ...previous,
                  settings: {
                    ...previous.settings,
                    defaultDocumentAccess: event.target
                      .value as Workspace["settings"]["defaultDocumentAccess"],
                  },
                })),
              )
            }
          >
            {[
              ["public", "All staff"],
              ["department", "Department"],
              ["project", "Project members"],
              ["restricted", "Selected staff"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Link to="/documents" className="text-sm text-primary underline">
            Manage document permissions
          </Link>
        </Card>
      )}
      {tab === "Report reminders" && <ReminderSettings />}
      {invite && <InviteForm onClose={() => setInvite(false)} onCreated={setInviteLink} />}
      {department && (
        <RecordDialog
          title={department === "new" ? "Add department" : "Edit department"}
          onClose={() => setDepartment(null)}
          initial={{
            id: department === "new" ? "" : department.id,
            name: department === "new" ? "" : department.name,
            blurb: department === "new" ? "" : department.blurb,
            modules: department === "new" ? "" : department.modules.join(", "),
          }}
          fields={() => [
            ...(department === "new"
              ? [
                  {
                    name: "id" as const,
                    label:
                      "Department code (lowercase, letters, numbers and hyphens; max 20 characters)",
                    required: true,
                    help: "Use a unique code such as customer-service.",
                  },
                ]
              : []),
            { name: "name", label: "Name", required: true },
            { name: "blurb", label: "Description", type: "textarea" as const, required: true },
            { name: "modules", label: "Modules (comma separated)", required: true },
          ]}
          onSave={(values) => {
            const id = department === "new" ? values.id.trim() : department.id;
            if (department === "new" && !/^[a-z][a-z0-9-]{0,19}$/.test(id))
              throw new Error(
                "Use a department code starting with a lowercase letter, followed by lowercase letters, numbers or hyphens (max 20 characters).",
              );
            if (department === "new" && departments.some((item) => item.id === id))
              throw new Error("A department with this code already exists.");
            return saveRecord("departments", {
              id,
              name: values.name,
              blurb: values.blurb,
              modules: [
                ...new Set(
                  values.modules
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                ),
              ],
            });
          }}
        />
      )}
      {template && (
        <RecordDialog
          title={selectedTemplate ? "Edit report template" : "Add report template"}
          onClose={() => setTemplate(null)}
          initial={{
            name: selectedTemplate?.name ?? "",
            progress: selectedTemplate?.progress ?? "Progress made",
            blockers: selectedTemplate?.blockers ?? "Blockers / support needed",
            next: selectedTemplate?.next ?? "Next steps",
          }}
          fields={[
            { name: "name", label: "Template name", required: true },
            { name: "progress", label: "Progress field label", required: true },
            { name: "blockers", label: "Blockers field label", required: true },
            { name: "next", label: "Next steps field label", required: true },
          ]}
          onSave={(values) =>
            saveRecord("templates", { ...values, id: selectedTemplate?.id ?? crypto.randomUUID() })
          }
        />
      )}
    </div>
  );
}

function InviteForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (link: string) => void;
}) {
  const { people, accounts, departments } = useWorkspace();
  return (
    <RecordDialog
      title="Invite staff"
      description={
        isDemo
          ? "Create a local activation link."
          : "Invite a staff member by email. You can also copy their activation link."
      }
      onClose={onClose}
      initial={{ personId: "", name: "", title: "", dept: "hr", email: "", role: "staff" }}
      fields={(values) => [
        {
          name: "personId",
          label: "Staff member",
          type: "select",
          options: [
            { value: "", label: "New staff member" },
            ...people
              .filter((person) => !accounts.some((account) => account.personId === person.id))
              .map((person) => ({ value: person.id, label: person.name })),
          ],
        },
        ...(!values.personId
          ? [
              { name: "name" as const, label: "Full name", required: true },
              { name: "title" as const, label: "Job title", required: true },
              {
                name: "dept" as const,
                label: "Department",
                type: "select" as const,
                options: departments.map((department) => ({
                  value: department.id,
                  label: department.name,
                })),
              },
            ]
          : []),
        { name: "email", label: "Email", type: "email", required: true },
        {
          name: "role",
          label: "Role",
          type: "select",
          options: [
            { value: "staff", label: "Staff" },
            { value: "ceo", label: "CEO" },
          ],
        },
      ]}
      onSave={async (values) => {
        if (!isDemo) {
          const result = await mutateApi<{ invitationUrl: string; emailSent: boolean }>(
            "/invitations",
            {
              method: "POST",
              body: JSON.stringify(
                values.personId
                  ? { personId: values.personId, email: values.email, role: values.role }
                  : {
                      name: values.name,
                      title: values.title,
                      dept: values.dept,
                      email: values.email,
                      role: values.role,
                    },
              ),
            },
          );
          onCreated(result.invitationUrl);
          if (!result.emailSent) toast.info("Share the invitation link. Email was not delivered.");
          return;
        }
        const personId = values.personId || crypto.randomUUID();
        const person = values.personId
          ? people.find((person) => person.id === values.personId)!
          : personSchema.parse({
              id: personId,
              name: values.name,
              title: values.title,
              dept: values.dept,
            });
        const token = crypto.randomUUID();
        await updateWorkspace((previous) => ({
          ...previous,
          people: values.personId ? previous.people : [...previous.people, person],
          accounts: [
            ...previous.accounts,
            {
              id: crypto.randomUUID(),
              personId,
              email: values.email.trim().toLowerCase(),
              role: values.role as "ceo" | "staff",
              active: true,
              salt: "",
              passwordHash: "",
              invitation: token,
              invitationExpires: Date.now() + 7 * 86400000,
            },
          ],
        }));
        onCreated(`${window.location.origin}/login?token=${token}`);
      }}
    />
  );
}

function BusinessPermissions() {
  const { people, businesses, businessAccess, staffBusiness } = useWorkspace();
  const [personId, setPersonId] = useState(people[0]?.id ?? "");
  const home = staffBusiness.find((row) => row.person === personId)?.business ?? "";
  const change = (
    business: string,
    patch: { manage?: boolean; finance?: "view" | "manage" | undefined },
    enabled = true,
  ) =>
    perform(() =>
      updateWorkspace((previous) => ({
        ...previous,
        businessAccess: [
          ...previous.businessAccess.filter(
            (row) => !(row.person === personId && row.business === business),
          ),
          ...(enabled
            ? [
                {
                  ...previous.businessAccess.find(
                    (row) => row.person === personId && row.business === business,
                  ),
                  person: personId,
                  business,
                  ...patch,
                },
              ]
            : []),
        ],
      })),
    );
  return (
    <Card>
      <h2 className="mb-4 font-display text-lg font-semibold">Staff business permissions</h2>
      <div className="mb-4 flex flex-wrap gap-4">
        <label className="field-label">
          Staff member
          <select
            className="field-input"
            value={personId}
            onChange={(event) => setPersonId(event.target.value)}
          >
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Works for
          <select
            className="field-input"
            value={home}
            onChange={(event) => {
              const business = event.target.value;
              void perform(() =>
                updateWorkspace((previous) => ({
                  ...previous,
                  staffBusiness: [
                    ...previous.staffBusiness.filter((row) => row.person !== personId),
                    ...(business ? [{ person: personId, business }] : []),
                  ],
                })),
              );
            }}
          >
            <option value="">Amsol (core staff)</option>
            {businesses
              .filter((business) => business.id !== "b0")
              .map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Assign several businesses independently. Business management and financial access are
        separate permissions. The CEO has full access.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="p-3">Business</th>
              <th className="p-3">Assigned</th>
              <th className="p-3">Manage business</th>
              <th className="p-3">Finance</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((business) => {
              const grant = businessAccess.find(
                (row) => row.person === personId && row.business === business.id,
              );
              return (
                <tr className="border-t" key={business.id}>
                  <td className="p-3">{business.name}</td>
                  <td className="p-3">
                    <input
                      type="checkbox"
                      aria-label={`Assign ${business.name}`}
                      checked={!!grant}
                      onChange={(event) => {
                        void change(business.id, {}, event.target.checked);
                      }}
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="checkbox"
                      aria-label={`Manage ${business.name}`}
                      checked={grant?.manage ?? false}
                      onChange={(event) => {
                        void change(business.id, { manage: event.target.checked });
                      }}
                    />
                  </td>
                  <td className="p-3">
                    <select
                      className="field-input"
                      aria-label={`Finance access for ${business.name}`}
                      value={grant?.finance ?? "none"}
                      onChange={(event) => {
                        void change(business.id, {
                          finance:
                            event.target.value === "none"
                              ? undefined
                              : (event.target.value as "view" | "manage"),
                        });
                      }}
                    >
                      <option value="none">No finance access</option>
                      <option value="view">View finance</option>
                      <option value="manage">Manage finance</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ReminderSettings() {
  const { settings } = useWorkspace();
  const [company, setCompany] = useState(settings.company);
  const [days, setDays] = useState(settings.reminderDays);
  const [enabled, setEnabled] = useState(settings.remindersEnabled);
  return (
    <Card>
      <h2 className="mb-4 font-display text-lg font-semibold">Workspace and reminders</h2>
      <form
        className="max-w-sm space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          perform(() =>
            updateWorkspace((previous) => ({
              ...previous,
              settings: {
                ...previous.settings,
                company: company.trim(),
                reminderDays: days,
                remindersEnabled: enabled,
              },
            })),
          );
        }}
      >
        <label className="field-label">
          Workspace name
          <input
            required
            className="field-input"
            maxLength={200}
            value={company}
            onChange={(event) => setCompany(event.target.value)}
          />
        </label>
        <label className="field-label">
          Remind after (days)
          <input
            type="number"
            min={1}
            max={30}
            step={1}
            required
            className="field-input"
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          Show overdue report reminders on dashboards
        </label>
        <p className="text-xs text-muted-foreground">
          These reminders appear in the app. Weekly plans and reports have separate schedules.
        </p>
        <Button type="submit">Save settings</Button>
        <p>
          <Link to="/weekly-settings" className="text-sm text-primary underline">
            Configure weekly reporting and email schedules
          </Link>
        </p>
      </form>
    </Card>
  );
}

function ModuleAccessSettings() {
  const { accounts, people } = useWorkspace();
  const [saving, setSaving] = useState(false);
  return (
    <Card>
      <h2 className="mb-2 font-display text-lg font-semibold">Production modules</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Assign modules independently. View includes reports and previews. Manage allows changes. The
        CEO has full Water, Blog, Tender and Inventory access. Payment Ledger uses its own grant.
      </p>
      {isDemo ? (
        <p>Module permissions are available when connected to the backend.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-3 text-left">Staff member</th>
                <th className="p-3 text-left">Water Project</th>
                <th className="p-3 text-left">Blog</th>
                <th className="p-3 text-left">Payment Ledger</th>
                <th className="p-3 text-left">Inventory</th>
                <th className="p-3 text-left">Tenders</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-t">
                  <td className="p-3">
                    {people.find((person) => person.id === account.personId)?.name}
                    <div className="text-xs text-muted-foreground">{account.email}</div>
                  </td>
                  {(["water", "blog", "ledger", "inventory", "tender"] as const).map((module) => (
                    <td key={module} className="p-3">
                      <select
                        aria-label={module + " access for " + account.email}
                        className="field-input"
                        value={
                          account.role === "ceo" && module !== "ledger"
                            ? "manage"
                            : (account.modules?.[module] ?? "none")
                        }
                        disabled={saving || (account.role === "ceo" && module !== "ledger")}
                        onChange={(event) => {
                          const access = event.target.value;
                          setSaving(true);
                          void mutateApi(
                            "/accounts/" + encodeURIComponent(account.id) + "/modules",
                            { method: "PUT", body: JSON.stringify({ module, access }) },
                          )
                            .then(() => toast.success("Module access updated"))
                            .catch((error: unknown) =>
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "Access could not be updated",
                              ),
                            )
                            .finally(() => setSaving(false));
                        }}
                      >
                        <option value="none">No access</option>
                        <option value="view">View</option>
                        <option value="manage">Manage</option>
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
