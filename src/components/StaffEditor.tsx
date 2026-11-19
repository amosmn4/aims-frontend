import type { Person } from "@/lib/data";
import { personSchema } from "@/lib/models";
import { saveRecord, saveStaffProfile, useWorkspace } from "@/lib/workspace";
import { RecordDialog } from "./RecordDialog";

export function StaffEditor({
  record,
  onClose,
}: {
  record?: Person | undefined;
  onClose: () => void;
}) {
  const { accounts, departments } = useWorkspace();
  const account = accounts.find((row) => row.personId === record?.id);
  const canEditEmail = account?.role === "staff";
  return (
    <RecordDialog
      title={record ? "Edit staff" : "Add staff"}
      onClose={onClose}
      initial={{
        name: record?.name ?? "",
        title: record?.title ?? "",
        dept: record ? (record.dept ?? "") : "hr",
        email: account?.email ?? "",
      }}
      fields={[
        { name: "name", label: "Full name", required: true },
        { name: "title", label: "Job title", required: true },
        {
          name: "dept",
          label: "Department",
          type: "select",
          options: [
            { value: "", label: "Executive" },
            ...departments.map((department) => ({ value: department.id, label: department.name })),
          ],
        },
        ...(canEditEmail
          ? [
              {
                name: "email" as const,
                label: "Email",
                type: "email" as const,
                required: true,
                help: "Email changes sign the staff member out and invalidate old setup links. Resend their invitation after saving if needed.",
              },
            ]
          : []),
      ]}
      onSave={(values) => {
        const profile = personSchema.parse({
          id: record?.id ?? crypto.randomUUID(),
          name: values.name,
          title: values.title,
          dept: values.dept || null,
        });
        return record && (!account || account.role === "staff")
          ? saveStaffProfile(profile, canEditEmail ? values.email : undefined)
          : saveRecord("people", profile);
      }}
    />
  );
}
