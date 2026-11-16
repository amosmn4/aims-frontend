export type DeptId = string;
export type Status = "on-track" | "at-risk" | "delayed" | "completed";
export type Stage = "Planning" | "In progress" | "Review" | "Completed";
export type Access = "public" | "department" | "project" | "restricted";

export const departments: { id: DeptId; name: string; blurb: string; modules: string[] }[] = [
  {
    id: "hr",
    name: "HR Services",
    blurb: "HR consultancy, recruitment & training for clients",
    modules: ["Client accounts", "Recruitment pipeline", "Training sessions"],
  },
  {
    id: "finance",
    name: "Finance",
    blurb: "Payroll (internal & clients), project finances, sister companies",
    modules: ["Payroll runs", "Project budgets", "Sister companies"],
  },
  {
    id: "it",
    name: "IT",
    blurb: "Recruitment system, databases & internal tools",
    modules: ["Systems register", "Support tickets", "Database health"],
  },
  {
    id: "marketing",
    name: "Marketing",
    blurb: "Amsol brand and social pages",
    modules: ["Content calendar", "Social posts", "Campaigns"],
  },
  {
    id: "operations",
    name: "Operations",
    blurb: "Handles and tracks client requests",
    modules: ["Client requests", "SLA tracker", "Escalations"],
  },
];

export const people = [
  { id: "p1", name: "Ruth Kamau", title: "Chief Executive Officer", dept: null as DeptId | null },
  { id: "p2", name: "Brian Otieno", title: "HR Consultant", dept: "hr" as DeptId },
  { id: "p3", name: "Faith Njeri", title: "Recruitment Consultant", dept: "hr" as DeptId },
  { id: "p4", name: "Kevin Mutua", title: "Finance Officer", dept: "finance" as DeptId },
  { id: "p5", name: "Lucy Achieng", title: "Finance Officer", dept: "finance" as DeptId },
  { id: "p6", name: "Dennis Kiprop", title: "Systems Specialist", dept: "it" as DeptId },
  { id: "p7", name: "Mercy Wambui", title: "Marketing Specialist", dept: "marketing" as DeptId },
  { id: "p8", name: "Peter Ouma", title: "Operations Officer", dept: "operations" as DeptId },
  { id: "p9", name: "Joy Chebet", title: "HR Trainer", dept: "hr" as DeptId },
];
export type Person = (typeof people)[number];
export const person = (id: string) => people.find((p) => p.id === id)!;

export type Client = { id: string; name: string; services: string[]; contact: string };
export const clients: Client[] = [
  {
    id: "c1",
    name: "Savanna Foods Ltd",
    services: ["Payroll", "HR Consultancy"],
    contact: "Ann Mwangi",
  },
  {
    id: "c2",
    name: "Lakeview Hospital",
    services: ["Recruitment", "Training"],
    contact: "Dr. Sam Were",
  },
  { id: "c3", name: "Kilima Logistics", services: ["Payroll"], contact: "John Kariuki" },
  {
    id: "c4",
    name: "Pwani Hotels Group",
    services: ["Recruitment", "HR Consultancy", "Training"],
    contact: "Halima Ali",
  },
];
export const client = (id: string) => clients.find((c) => c.id === id);

export type Project = {
  id: string;
  name: string;
  client?: string | undefined;
  lead: string;
  depts: DeptId[];
  members: string[];
  status: Status;
  stage: Stage;
  progress: number;
  due: string;
  summary: string;
};
export const projects: Project[] = [
  {
    id: "pr1",
    name: "Pwani Hotels mass recruitment",
    client: "c4",
    lead: "p2",
    depts: ["hr", "operations", "it"],
    members: ["p2", "p3", "p8", "p6"],
    status: "on-track",
    stage: "In progress",
    progress: 62,
    due: "2026-11-30",
    summary: "Recruit 120 staff across 4 coastal hotels before peak season.",
  },
  {
    id: "pr2",
    name: "Savanna Foods payroll migration",
    client: "c1",
    lead: "p5",
    depts: ["finance", "it"],
    members: ["p5", "p4", "p6"],
    status: "at-risk",
    stage: "In progress",
    progress: 45,
    due: "2026-10-31",
    summary: "Move 850 employees onto Amsol's payroll platform.",
  },
  {
    id: "pr3",
    name: "Lakeview leadership training",
    client: "c2",
    lead: "p9",
    depts: ["hr"],
    members: ["p9", "p2"],
    status: "on-track",
    stage: "Review",
    progress: 85,
    due: "2026-10-25",
    summary: "6-week leadership programme for 40 ward managers.",
  },
  {
    id: "pr4",
    name: "Recruitment system v2",
    lead: "p6",
    depts: ["it", "hr"],
    members: ["p6", "p3"],
    status: "delayed",
    stage: "In progress",
    progress: 30,
    due: "2026-10-20",
    summary: "New candidate portal and shortlisting tools.",
  },
  {
    id: "pr5",
    name: "Q4 brand campaign",
    lead: "p7",
    depts: ["marketing", "hr"],
    members: ["p7", "p9"],
    status: "on-track",
    stage: "Planning",
    progress: 15,
    due: "2026-12-15",
    summary: "Thought-leadership series and social campaign.",
  },
  {
    id: "pr6",
    name: "Kilima Logistics payroll onboarding",
    client: "c3",
    lead: "p4",
    depts: ["finance", "operations"],
    members: ["p4", "p8"],
    status: "completed",
    stage: "Completed",
    progress: 100,
    due: "2026-09-30",
    summary: "Onboarded 300 drivers onto monthly payroll.",
  },
  {
    id: "pr7",
    name: "Lakeview HR & payroll rollout",
    client: "c2",
    lead: "p2",
    depts: ["hr", "finance", "it"],
    members: ["p2", "p4", "p5", "p6"],
    status: "on-track",
    stage: "In progress",
    progress: 25,
    due: "2027-01-31",
    summary: "Roll out Amsol recruitment portal and payroll for Lakeview's 200 support staff.",
  },
];
export const project = (id: string) => projects.find((p) => p.id === id);

export type Task = {
  id: string;
  title: string;
  description?: string | undefined;
  project: string;
  assignee: string;
  due: string;
  priority: "High" | "Medium" | "Low";
  status: "To do" | "In progress" | "Done";
  ceoComment?: string | undefined;
};
export const tasks: Task[] = [
  {
    id: "t1",
    title: "Shortlist front-office candidates",
    project: "pr1",
    assignee: "p3",
    due: "2026-10-18",
    priority: "High",
    status: "In progress",
  },
  {
    id: "t2",
    title: "Schedule interview panels",
    project: "pr1",
    assignee: "p8",
    due: "2026-10-21",
    priority: "Medium",
    status: "To do",
  },
  {
    id: "t3",
    title: "Set up job portal for Pwani",
    project: "pr1",
    assignee: "p6",
    due: "2026-10-17",
    priority: "High",
    status: "Done",
  },
  {
    id: "t4",
    title: "Reconcile September payroll data",
    project: "pr2",
    assignee: "p4",
    due: "2026-10-17",
    priority: "High",
    status: "In progress",
  },
  {
    id: "t5",
    title: "Import employee master file",
    project: "pr2",
    assignee: "p6",
    due: "2026-10-22",
    priority: "High",
    status: "To do",
  },
  {
    id: "t6",
    title: "Approve parallel payroll run",
    project: "pr2",
    assignee: "p5",
    due: "2026-10-28",
    priority: "Medium",
    status: "To do",
  },
  {
    id: "t7",
    title: "Final module assessments",
    project: "pr3",
    assignee: "p9",
    due: "2026-10-23",
    priority: "Medium",
    status: "In progress",
  },
  {
    id: "t8",
    title: "Candidate portal UI testing",
    project: "pr4",
    assignee: "p3",
    due: "2026-10-19",
    priority: "Medium",
    status: "To do",
  },
  {
    id: "t9",
    title: "Fix shortlisting filter bug",
    project: "pr4",
    assignee: "p6",
    due: "2026-10-16",
    priority: "High",
    status: "In progress",
  },
  {
    id: "t10",
    title: "Draft campaign content plan",
    project: "pr5",
    assignee: "p7",
    due: "2026-10-24",
    priority: "Low",
    status: "To do",
  },
  {
    id: "t11",
    title: "Statutory deductions check",
    project: "pr2",
    assignee: "p4",
    due: "2026-10-20",
    priority: "Medium",
    status: "To do",
  },
  {
    id: "t12",
    title: "Collect Lakeview staff data for payroll",
    project: "pr7",
    assignee: "p4",
    due: "2026-10-27",
    priority: "High",
    status: "In progress",
  },
  {
    id: "t13",
    title: "Configure recruitment portal for Lakeview",
    project: "pr7",
    assignee: "p6",
    due: "2026-11-03",
    priority: "Medium",
    status: "To do",
  },
  {
    id: "t14",
    title: "Draft recruitment plan for support roles",
    project: "pr7",
    assignee: "p2",
    due: "2026-10-30",
    priority: "Medium",
    status: "To do",
  },
];

export type Report = {
  id: string;
  title: string;
  type: "Project update" | "Weekly department" | "Ad-hoc";
  project?: string | undefined;
  dept: DeptId;
  author: string;
  date: string;
  progress?: string | undefined;
  blockers?: string | undefined;
  next?: string | undefined;
  reviewed: boolean;
  comment?: string | undefined;
};
export const reports: Report[] = [
  {
    id: "r1",
    title: "Week 6 recruitment update",
    type: "Project update",
    project: "pr1",
    dept: "hr",
    author: "p2",
    date: "2026-10-15",
    progress: "74 of 120 positions filled. Housekeeping complete.",
    blockers: "Chef roles slow - few qualified applicants.",
    next: "Head-hunt via culinary schools.",
    reviewed: true,
    comment: "Good pace. Keep me posted on chefs.",
  },
  {
    id: "r2",
    title: "Payroll migration status",
    type: "Project update",
    project: "pr2",
    dept: "finance",
    author: "p5",
    date: "2026-10-14",
    progress: "Data mapping done for 6 of 9 branches.",
    blockers: "Client delayed sending bank details.",
    next: "Escalate with client HR on Friday.",
    reviewed: false,
  },
  {
    id: "r3",
    title: "IT weekly report",
    type: "Weekly department",
    dept: "it",
    author: "p6",
    date: "2026-10-13",
    progress: "Portal beta deployed; DB backups verified.",
    blockers: "Shortlisting bug pushing v2 timeline.",
    next: "Patch and retest by Monday.",
    reviewed: false,
  },
  {
    id: "r4",
    title: "Marketing weekly report",
    type: "Weekly department",
    dept: "marketing",
    author: "p7",
    date: "2026-10-13",
    progress: "LinkedIn followers +8%. 3 articles published.",
    next: "Launch Q4 campaign brief.",
    reviewed: true,
  },
  {
    id: "r5",
    title: "Client requests - week 41",
    type: "Weekly department",
    dept: "operations",
    author: "p8",
    date: "2026-10-12",
    progress: "23 requests received, 19 closed.",
    blockers: "2 payroll queries awaiting Finance.",
    next: "Clear backlog.",
    reviewed: false,
  },
  {
    id: "r6",
    title: "Payroll reconciliation progress",
    type: "Project update",
    project: "pr2",
    dept: "finance",
    author: "p4",
    date: "2026-10-11",
    progress: "Variance down to 0.4%.",
    next: "Close statutory checks.",
    reviewed: true,
  },
  {
    id: "r7",
    title: "Lakeview rollout kickoff update",
    type: "Project update",
    project: "pr7",
    dept: "hr",
    author: "p2",
    date: "2026-10-21",
    progress: "Kickoff held. Staff data collection started for 200 support staff.",
    blockers: "Waiting for Lakeview HR to confirm shift allowances.",
    next: "Finalise recruitment plan and portal setup.",
    reviewed: false,
  },
];

export const documents: Doc[] = [
  {
    id: "d1",
    name: "Amsol Employee Handbook 2026.pdf",
    folder: "Company",
    access: "public" as Access,
    owner: "p2",
    updated: "2026-09-02",
  },
  {
    id: "d2",
    name: "Pwani Hotels - Service Agreement.pdf",
    folder: "Clients / Pwani Hotels",
    access: "project" as Access,
    project: "pr1",
    owner: "p2",
    updated: "2026-08-14",
  },
  {
    id: "d3",
    name: "Savanna Foods payroll master.xlsx",
    folder: "Finance / Payroll",
    access: "restricted" as Access,
    allowed: ["p5", "p4"],
    owner: "p5",
    updated: "2026-10-10",
  },
  {
    id: "d4",
    name: "Recruitment system architecture.docx",
    folder: "IT / Systems",
    access: "department" as Access,
    dept: "it" as DeptId,
    owner: "p6",
    updated: "2026-09-28",
  },
  {
    id: "d5",
    name: "Brand guidelines.pdf",
    folder: "Marketing",
    access: "public" as Access,
    owner: "p7",
    updated: "2026-07-01",
  },
  {
    id: "d6",
    name: "Leadership training curriculum.pptx",
    folder: "Projects / Lakeview",
    access: "project" as Access,
    project: "pr3",
    owner: "p9",
    updated: "2026-09-15",
  },
  {
    id: "d7",
    name: "Sister companies - FY26 accounts.xlsx",
    folder: "Finance / Sister companies",
    access: "restricted" as Access,
    allowed: ["p5"],
    owner: "p5",
    updated: "2026-10-01",
  },
  {
    id: "d8",
    name: "HR consultancy proposal template.docx",
    folder: "HR Services",
    access: "department" as Access,
    dept: "hr" as DeptId,
    owner: "p2",
    updated: "2026-08-20",
  },
  {
    id: "d9",
    name: "Client request SOP.pdf",
    folder: "Operations",
    access: "public" as Access,
    owner: "p8",
    updated: "2026-06-11",
  },
];
export type Doc = {
  id: string;
  name: string;
  folder: string;
  access: Access;
  owner: string;
  updated: string;
  project?: string | undefined;
  dept?: DeptId | undefined;
  allowed?: string[] | undefined;
  fileKey?: string | undefined;
  sample?: boolean | undefined;
  mime?: string | undefined;
};

export const deptName = (id: DeptId) => departments.find((d) => d.id === id)?.name ?? id;

export const tenderStages = [
  "Identified",
  "Under application",
  "Submitted",
  "Withdrawn",
  "Cancelled",
  "Won",
  "Lost",
] as const;
export type TenderStage = (typeof tenderStages)[number];
export type Tender = {
  id: string;
  title: string;
  issuer: string;
  value: number;
  due: string;
  stage: TenderStage;
  members: string[];
  notes?: string | undefined;
};
export const tenders: Tender[] = [
  {
    id: "tn1",
    title: "County staff recruitment outsourcing",
    issuer: "County Government of Nakuru",
    value: 4800000,
    due: "2026-11-06",
    stage: "Submitted",
    members: ["p2", "p3"],
    notes: "18-month recruitment outsourcing contract.",
  },
  {
    id: "tn2",
    title: "Payroll bureau services",
    issuer: "Rift Valley Water Works",
    value: 2600000,
    due: "2026-11-14",
    stage: "Under application",
    members: ["p4", "p5"],
    notes: "Requested tender documents; awaiting addendum.",
  },
  {
    id: "tn3",
    title: "HR consultancy framework 2027",
    issuer: "Agricultural Finance Corporation",
    value: 7200000,
    due: "2026-11-27",
    stage: "Identified",
    members: ["p2"],
    notes: "Spotted on the public procurement portal.",
  },
  {
    id: "tn4",
    title: "Training provider panel",
    issuer: "Pwani Hotels Group",
    value: 1500000,
    due: "2026-10-09",
    stage: "Won",
    members: ["p9", "p2"],
    notes: "Awarded a 2-year training panel slot.",
  },
  {
    id: "tn5",
    title: "Recruitment system supply",
    issuer: "Mombasa County",
    value: 5400000,
    due: "2026-09-18",
    stage: "Lost",
    members: ["p6"],
    notes: "Priced out by an incumbent vendor.",
  },
  {
    id: "tn6",
    title: "Staff medical scheme administration",
    issuer: "Kilima Logistics",
    value: 3100000,
    due: "2026-10-30",
    stage: "Withdrawn",
    members: ["p4"],
    notes: "Scope overlapped with an existing client contract.",
  },
];

export const requestStatuses = ["Received", "In progress", "Closed"] as const;
export type RequestStatus = (typeof requestStatuses)[number];
export type ClientRequest = {
  id: string;
  title: string;
  client?: string | undefined;
  prospectClientName?: string | undefined;
  source: "operations" | "marketing";
  received: string;
  handler: string;
  status: RequestStatus;
  notes?: string | undefined;
};
export const clientRequests: ClientRequest[] = [
  {
    id: "cr1",
    title: "Payroll query - October payslips",
    client: "c1",
    source: "operations",
    received: "2026-10-14",
    handler: "p4",
    status: "In progress",
    notes: "Two staff missing the overnight allowance.",
  },
  {
    id: "cr2",
    title: "Request 20 extra kitchen staff",
    client: "c4",
    source: "operations",
    received: "2026-10-12",
    handler: "p8",
    status: "Received",
  },
  {
    id: "cr3",
    title: "Shift allowance policy clarification",
    client: "c2",
    source: "operations",
    received: "2026-10-10",
    handler: "p8",
    status: "In progress",
    notes: "Waiting on Lakeview HR to confirm.",
  },
  {
    id: "cr4",
    title: "Recruitment portal access for new HR manager",
    client: "c2",
    source: "operations",
    received: "2026-10-08",
    handler: "p6",
    status: "Closed",
    notes: "Access granted 9 Oct.",
  },
  {
    id: "cr5",
    title: "September payroll reconciliation copy",
    client: "c3",
    source: "operations",
    received: "2026-10-06",
    handler: "p5",
    status: "Closed",
  },
  {
    id: "cr6",
    title: "Training venue change for cohort 3",
    client: "c2",
    source: "marketing",
    received: "2026-10-16",
    handler: "p9",
    status: "Received",
  },
];

export type Business = { id: string; name: string; sector: string };
export type BusinessFinance = {
  id: string;
  business: string;
  month: string;
  date: string;
  description: string;
  revenue: number;
  expenses: number;
  note?: string | undefined;
};
export const businesses: Business[] = [
  { id: "b0", name: "Amsol (core)", sector: "HR consultancy & payroll" },
  { id: "b1", name: "Water project", sector: "Water supply" },
  { id: "b2", name: "Hardware", sector: "Building materials retail" },
  { id: "b3", name: "Supermarket", sector: "Retail" },
  { id: "b4", name: "Restaurant", sector: "Hospitality" },
];
export const CORE_BUSINESS_ID = "b0";
export type PersonBusiness = { person: string; business: string };
export const staffBusiness: PersonBusiness[] = [
  { person: "p9", business: "b1" },
  { person: "p7", business: "b3" },
];
export const businessAccess: PersonBusiness[] = [{ person: "p6", business: "b1" }];
export const businessFinance: BusinessFinance[] = [
  {
    id: "bf1",
    business: "b0",
    month: "2026-08",
    date: "2026-08-31",
    description: "Monthly summary",
    revenue: 4200000,
    expenses: 2750000,
  },
  {
    id: "bf2",
    business: "b0",
    month: "2026-09",
    date: "2026-09-30",
    description: "Monthly summary",
    revenue: 4650000,
    expenses: 2980000,
  },
  {
    id: "bf3",
    business: "b0",
    month: "2026-10",
    date: "2026-10-31",
    description: "Monthly summary",
    revenue: 4900000,
    expenses: 3150000,
  },
  {
    id: "bf4",
    business: "b1",
    month: "2026-08",
    date: "2026-08-31",
    description: "Monthly summary",
    revenue: 820000,
    expenses: 410000,
  },
  {
    id: "bf5",
    business: "b1",
    month: "2026-09",
    date: "2026-09-30",
    description: "Monthly summary",
    revenue: 860000,
    expenses: 425000,
  },
  {
    id: "bf6",
    business: "b1",
    month: "2026-10",
    date: "2026-10-31",
    description: "Monthly summary",
    revenue: 905000,
    expenses: 448000,
  },
  {
    id: "bf7",
    business: "b2",
    month: "2026-08",
    date: "2026-08-31",
    description: "Monthly summary",
    revenue: 1350000,
    expenses: 1010000,
  },
  {
    id: "bf8",
    business: "b2",
    month: "2026-09",
    date: "2026-09-30",
    description: "Monthly summary",
    revenue: 1420000,
    expenses: 1060000,
  },
  {
    id: "bf9",
    business: "b2",
    month: "2026-10",
    date: "2026-10-31",
    description: "Monthly summary",
    revenue: 1280000,
    expenses: 965000,
  },
  {
    id: "bf10",
    business: "b3",
    month: "2026-08",
    date: "2026-08-31",
    description: "Monthly summary",
    revenue: 2100000,
    expenses: 1740000,
  },
  {
    id: "bf11",
    business: "b3",
    month: "2026-09",
    date: "2026-09-30",
    description: "Monthly summary",
    revenue: 2250000,
    expenses: 1830000,
  },
  {
    id: "bf12",
    business: "b3",
    month: "2026-10",
    date: "2026-10-31",
    description: "Monthly summary",
    revenue: 2400000,
    expenses: 1910000,
  },
  {
    id: "bf13",
    business: "b4",
    month: "2026-08",
    date: "2026-08-31",
    description: "Monthly summary",
    revenue: 640000,
    expenses: 525000,
  },
  {
    id: "bf14",
    business: "b4",
    month: "2026-09",
    date: "2026-09-30",
    description: "Monthly summary",
    revenue: 610000,
    expenses: 538000,
  },
  {
    id: "bf15",
    business: "b4",
    month: "2026-10",
    date: "2026-10-31",
    description: "Monthly summary",
    revenue: 705000,
    expenses: 562000,
  },
];
