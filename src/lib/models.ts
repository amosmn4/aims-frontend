import { z } from "zod";

const id = z.string().trim().min(1).max(100);
const text = z.string().trim().min(1).max(200);
export const deptId = z.string().regex(/^[a-z][a-z0-9-]{0,19}$/);
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Enter a valid date");
export const money = z.number().finite().min(0).max(1_000_000_000_000);
export const personSchema = z.object({ id, name: text, title: text, dept: deptId.nullable() });
export const clientSchema = z.object({
  id,
  name: text,
  contact: text,
  services: z.array(text).min(1),
  assignees: z.array(id).optional(),
  assignedDept: deptId.optional(),
  business: id.optional(),
});
export const projectSchema = z.object({
  id,
  name: text,
  client: id.optional(),
  lead: id,
  depts: z.array(deptId).min(1),
  members: z.array(id).min(1),
  status: z.enum(["on-track", "at-risk", "delayed", "completed"]),
  stage: z.enum(["Planning", "In progress", "Review", "Completed"]),
  progress: z.number().int().min(0).max(100),
  due: date,
  summary: z.string().trim().min(1).max(5000),
  business: id.optional(),
});
export const taskSchema = z.object({
  id,
  title: text,
  description: z.string().max(10000).optional(),
  project: z.string(),
  assignee: id,
  due: date,
  priority: z.enum(["Urgent", "High", "Medium", "Low"]),
  status: z.enum(["To do", "In progress", "Done"]),
  ceoComment: z.string().max(10000).optional(),
  business: id.optional(),
  weekStart: date.optional(),
  source: z.enum(["project", "planned", "ad_hoc", "contingency"]).optional(),
  subtasks: z.array(z.object({ id, title: text, done: z.boolean() })).optional(),
});
export const reportSchema = z.object({
  id,
  title: text,
  type: z.enum(["Monthly", "Project update", "Weekly department", "Ad-hoc"]),
  project: id.optional(),
  dept: deptId,
  author: id,
  date,
  progress: z.string().max(10000).optional(),
  blockers: z.string().max(10000).optional(),
  next: z.string().max(10000).optional(),
  reviewed: z.boolean(),
  comment: z.string().max(10000).optional(),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  status: z.enum(["draft", "submitted"]).optional(),
  business: id.optional(),
  taskIds: z.array(id).optional(),
  attachments: z.array(id).optional(),
  taskSnapshots: z
    .array(
      z.object({
        id,
        title: text,
        status: z.string(),
        due: date,
        source: z.string(),
        priority: z.enum(["Urgent", "High", "Medium", "Low"]).optional(),
        subtasks: z.array(z.object({ id, title: text, done: z.boolean() })).optional(),
      }),
    )
    .optional(),
  leaveSnapshot: z
    .array(z.object({ start: date, end: date, note: z.string().nullable().optional() }))
    .optional(),
});
export const documentSchema = z.object({
  id,
  name: text,
  folder: text,
  access: z.enum(["public", "department", "project", "restricted"]),
  owner: id,
  updated: date,
  project: id.optional(),
  task: id.optional(),
  weeklyRef: z.string().max(100).optional(),
  report: id.optional(),
  version: z.number().int().min(1).optional(),
  dept: deptId.optional(),
  allowed: z.array(id).optional(),
  fileKey: id.optional(),
  mime: z.string().optional(),
  sample: z.boolean().optional(),
});
export const tenderSchema = z.object({
  id,
  title: text,
  issuer: text,
  value: money,
  due: date,
  stage: z.enum([
    "Identified",
    "Under application",
    "Submitted",
    "Withdrawn",
    "Cancelled",
    "Won",
    "Lost",
  ]),
  members: z.array(id).min(1),
  notes: z.string().max(5000).optional(),
});
export const requestSchema = z
  .object({
    id,
    title: text,
    client: id.optional(),
    prospectClientName: text.optional(),
    source: z.enum(["operations", "marketing"]),
    received: date,
    handler: id,
    assignedDept: deptId.optional(),
    business: id.optional(),
    status: z.enum(["Received", "In progress", "Closed"]),
    notes: z.string().max(5000).optional(),
  })
  .strict()
  .refine(
    (request) => !!request.client !== !!request.prospectClientName,
    "Choose an existing client or enter a prospective client name, not both.",
  );
export const businessSchema = z.object({ id, name: text, sector: text });
export const financeSchema = z
  .object({
    id,
    business: id,
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    date,
    description: z.string().trim().min(1).max(5000),
    revenue: money,
    expenses: money,
    note: z.string().max(5000).optional(),
  })
  .strict()
  .refine((row) => row.date.slice(0, 7) === row.month, "Date and month must match");
export const accountSchema = z.object({
  id,
  personId: id,
  email: z.string().trim().email(),
  role: z.enum(["ceo", "staff", "system_admin"]),
  active: z.boolean(),
  modules: z
    .object({
      water: z.enum(["view", "manage"]).optional(),
      blog: z.enum(["view", "manage"]).optional(),
      ledger: z.enum(["view", "manage"]).optional(),
      inventory: z.enum(["view", "manage"]).optional(),
      tender: z.enum(["view", "manage"]).optional(),
    })
    .optional(),
  salt: z.string().default(""),
  passwordHash: z.string().default(""),
  hasPassword: z.boolean().optional(),
  invitation: z.string().optional(),
  invitationExpires: z.number().optional(),
});
export const moduleRecordSchema = z.object({
  id,
  dept: deptId,
  module: text,
  title: text,
  owner: id,
  date,
  status: z.enum(["Planned", "In progress", "Completed", "Blocked"]),
  notes: z.string().max(10000),
  amount: money.optional(),
});
export const workspaceSchema = z.object({
  version: z.literal(1),
  departments: z.array(
    z.object({ id: deptId, name: text, blurb: z.string().max(1000), modules: z.array(text) }),
  ),
  people: z.array(personSchema).min(1),
  clients: z.array(clientSchema),
  projects: z.array(projectSchema),
  tasks: z.array(taskSchema),
  reports: z.array(reportSchema),
  documents: z.array(documentSchema),
  tenders: z.array(tenderSchema),
  clientRequests: z.array(requestSchema),
  businesses: z.array(businessSchema),
  businessFinance: z.array(financeSchema),
  businessAccess: z.array(
    z.object({
      person: id,
      business: id,
      manage: z.boolean().optional(),
      finance: z.enum(["view", "manage"]).optional(),
    }),
  ),
  staffBusiness: z.array(z.object({ person: id, business: id })),
  accounts: z.array(accountSchema),
  moduleRecords: z.array(moduleRecordSchema),
  templates: z.array(z.object({ id, name: text, progress: text, blockers: text, next: text })),
  settings: z.object({
    company: text,
    reminderDays: z.number().int().min(1).max(30),
    remindersEnabled: z.boolean(),
    defaultDocumentAccess: z.enum(["public", "department", "project", "restricted"]),
  }),
});

export type Workspace = z.infer<typeof workspaceSchema>;
export type Account = z.infer<typeof accountSchema>;
export type ModuleRecord = z.infer<typeof moduleRecordSchema>;
export type StoredDocument = z.infer<typeof documentSchema>;
export type Collection = Exclude<
  keyof Workspace,
  "version" | "settings" | "businessAccess" | "staffBusiness"
>;
export type RecordOf<K extends Collection> = Workspace[K][number];
