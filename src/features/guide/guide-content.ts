import {
  ClipboardList,
  Cpu,
  Crown,
  Droplets,
  FileText,
  Megaphone,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

// Step text marks on-screen button and field labels as **Label**; the guide renders them as chips.
// Keep labels identical to the UI so people can match what they read to what they see.

export type RoleKey =
  "hr" | "tender" | "operations" | "finance" | "it" | "marketing" | "water" | "ceo_admin";

export interface HowTo {
  q: string;
  steps: string[];
  to?: string;
}

export interface RoleGuide {
  key: RoleKey;
  title: string;
  icon: LucideIcon;
  accent: string;
  intro: string;
  start: { label: string; to: string }[];
  howTo: HowTo[];
  goodToKnow: string[];
}

export const ROLE_GUIDES: RoleGuide[] = [
  {
    key: "hr",
    title: "HR",
    icon: Users,
    accent: "bg-success/10 text-success",
    intro:
      "HR delivers AMSOL's HR service lines to clients: recruitment, training, salary surveys, HR management and advisory. Everything you do lives inside a project. AIMS does not hold AMSOL's own staff records.",
    start: [
      { label: "HR home", to: "/hr" },
      { label: "Projects", to: "/hr/projects" },
      { label: "Recruitment", to: "/hr/recruitment" },
    ],
    howTo: [
      {
        q: "Start a new project",
        steps: [
          "On your **Home** page or the **Projects** page, click **New project**.",
          "Type the **Project name**, pick the **Service line**, and choose **One-off** or **Recurring**.",
          "Pick the **Client**, or choose **Create new client** if they're new. You can leave it empty and add it later.",
          "Click **Create project**. You land straight inside the new project.",
        ],
        to: "/hr/projects",
      },
      {
        q: "Add or change a project's client",
        steps: [
          "Open the project. On **Overview**, find **Client & contract**.",
          "Click **Add client** (or **Change client**), then pick a client or choose **Create new client**.",
        ],
        to: "/hr/projects",
      },
      {
        q: "Add a contract to a project",
        steps: [
          "A contract is optional. Only add one if the work is billed under a contract.",
          "Open the project. In **Client & contract**, click **New contract**. The title, client and dates are filled in for you.",
          "Enter the **Contract number** and value, then click **Create contract**. It's linked to the project automatically.",
          "Already have the contract? Click **Link existing contract** and choose it instead.",
        ],
        to: "/hr/projects",
      },
      {
        q: "Add and follow up tasks",
        steps: [
          "Open the project. Under **Next up**, type a task, pick a due date and who it's for, and click **Add task**.",
          "Click a task to update it. The **Tasks** tab shows every task for the project.",
          "To see every HR task, open **HR work** → **Tasks** and switch between Mine and Whole department. **My tasks** in the menu lists only yours.",
        ],
        to: "/hr/tasks",
      },
      {
        q: "Record recruitment numbers",
        steps: [
          "This only appears on projects with the **Recruitment** service line.",
          "Open the project. In **Recruitment numbers**, type how many applied, were screened, interviewed, offered and placed.",
          "Click **Save numbers**. Each stage can't be more than the one before it.",
          "The **Recruitment** page shows all recruitment projects and the totals.",
        ],
        to: "/hr/recruitment",
      },
      {
        q: "Finish, pause or cancel a project",
        steps: [
          "Open the project. On **Overview**, use the **Status** box under the dates.",
          "Choose **Completed**, **On hold** or **Cancelled**. It moves out of the open lists.",
        ],
        to: "/hr/projects",
      },
      {
        q: "Deal with a client request sent to HR",
        steps: [
          "Open **Client requests** in the menu and click the request's card.",
          "Log calls and meetings on its **Activity** tab and move it along with **Move to…**.",
          "Once it's **Won**, click **Start project from request**. Only HR staff see this for HR requests.",
        ],
        to: "/hr/pipeline",
      },
      {
        q: "See what needs attention and report on HR",
        steps: [
          "The **Needs attention** list on your **Home** page shows overdue tasks, projects past their end date and contracts ending soon.",
          "Open **Reports** for projects by service line and recruitment results. Click **Export HR report to Excel** to download.",
          "To send your monthly report, click **New report for the CEO**, then **Fill figures from AIMS**, add a **Summary for the CEO** and click **Submit to CEO**.",
        ],
        to: "/hr/reports",
      },
    ],
    goodToKnow: [
      "One-off work has an end date. Recurring work continues for the client and never shows as overdue.",
      "Choosing a service line sets One-off or Recurring for you. You can still change it.",
      "Training and salary surveys are simply projects on those service lines.",
    ],
  },
  {
    key: "tender",
    title: "Tender",
    icon: FileText,
    accent: "bg-destructive/10 text-destructive",
    intro:
      "You run AMSOL's tenders for every department: find tenders, prepare and submit bids, then hand won work to the department that will deliver it.",
    start: [
      { label: "Tender home", to: "/tender" },
      { label: "Tenders", to: "/tender/bid-pipeline" },
    ],
    howTo: [
      {
        q: "Log a new tender",
        steps: [
          "Open **Tender work** → **Tenders** and click **New tender** (it's on your **Home** page too).",
          "Enter the **Tender title**, **Issuing organisation**, value, **Submission deadline** and **Likely delivering department**, then click **Add tender**.",
        ],
        to: "/tender/bid-pipeline",
      },
      {
        q: "Prepare the bid",
        steps: [
          "Open the tender record: click it in the list on your **Home** page, or use Open the full tender in its side panel on the board.",
          "On **Requirements**, click **Add requirement**, **Apply template** or **Apply from document library**.",
          "On **Resources**, click **Assign resource**. On **Financials**, use **Add bond** and **Add line item**.",
          "Record effort on **Time tracking** with **Log time**.",
        ],
        to: "/tender",
      },
      {
        q: "Move a tender to the next stage",
        steps: [
          "Drag the card to the next column on the **Tenders** board, or use **Move to…** in its side panel or on the record.",
          "Choosing **Awarded** asks why you won (optional). On the record it also asks for the **Date awarded**.",
        ],
        to: "/tender/bid-pipeline",
      },
      {
        q: "Record a tender you didn't win",
        steps: [
          "Open the card's side panel on the board and click **Mark as not going ahead**.",
          "Choose **Not Awarded**, **Withdrawn** or **Cancelled**, type the reason, and click the matching button, e.g. **Mark as not awarded**.",
        ],
        to: "/tender/bid-pipeline",
      },
      {
        q: "Forward a won tender to a department",
        steps: [
          "When you mark a tender **Awarded**, the **Forward to department** form opens straight away. Closed it? Click **Forward to department** on the card, side panel or record.",
          "Choose the **Delivering department**. Check the **Project name**, and pick the **Client** if you know it and the **Start date**.",
          "Only switch on **Also create a contract** if the work has one. Click **Forward to department** to create the project.",
        ],
        to: "/tender/bid-pipeline",
      },
      {
        q: "Edit a tender or change its department",
        steps: [
          "Click **Edit tender** on the record or in its side panel on the board, or the pencil icon in the list on your **Home** page.",
          "Change any detail, including the **Department**, and click **Save tender**.",
        ],
        to: "/tender",
      },
      {
        q: "Delete a tender",
        steps: [
          "Click the bin icon in the list on your **Home** page or in its side panel on the board, or **Delete tender** on the record.",
          "Confirm with **Delete tender**. Its resources, financials and requirements are removed too.",
        ],
        to: "/tender",
      },
      {
        q: "Find a tender quickly",
        steps: [
          "Type in the search box above the **Tenders** board. It matches the title, reference, issuer and department.",
          "Click Mine (with your count) to see only the tenders you own.",
        ],
        to: "/tender/bid-pipeline",
      },
      {
        q: "Keep the standard bid documents in one place",
        steps: [
          "On your **Home** page, click **Mandatory documents library** (or open **Documents** and pick the **Mandatory documents** tab).",
          "Click **Add mandatory document**, choose the **File**, and click **Add mandatory document**.",
          "On a tender's **Requirements** tab, click **Apply from document library**, tick the ones that apply and click **Attach documents**.",
        ],
        to: "/tender/documents",
      },
    ],
    goodToKnow: [
      "Only the Tender team, or people given Tender edit access, can add, edit, move, delete or forward tenders.",
      "A contract is optional when forwarding. A client is only needed if you create a contract.",
      "Client requests are logged and routed by Operations. You only see requests routed to Tender.",
    ],
  },
  {
    key: "operations",
    title: "Operations",
    icon: ClipboardList,
    accent: "bg-primary/10 text-primary",
    intro:
      "You're the front door for client requests: log every inbound request, send it to the right department, and make sure its project gets started once won.",
    start: [
      { label: "Requests overview", to: "/operations" },
      { label: "Client requests", to: "/operations/requests" },
    ],
    howTo: [
      {
        q: "Log a client request and route it in one step",
        steps: [
          "Click **New client request**.",
          "Fill in **What is being requested?** Pick the **Client**, or click **Not a client yet? Type the company name**.",
          "Choose **Route to department** and, if you know who should handle it, **Assign to**. Leave it on **Not routed yet** to route it later.",
          "Add contact details if you have them and click **Log client request**.",
        ],
        to: "/operations/requests",
      },
      {
        q: "Route a request you logged earlier",
        steps: [
          "Open a request that isn't routed yet and click **Route to department**.",
          "Choose the **Department**, and **Assign to** someone if you know who should handle it. Click **Route to department**.",
        ],
        to: "/operations/requests",
      },
      {
        q: "Correct a request or move it to another department",
        steps: [
          "Open the request and click **Edit request**.",
          "Change any detail, including **Department** and **Assigned to**, and click **Save client request**.",
        ],
        to: "/operations/requests",
      },
      {
        q: "Record calls, emails and meetings",
        steps: [
          "Open the request and go to its **Activity** tab.",
          "Choose **What happened**, the day and a **Summary**, then click **Log activity**.",
        ],
        to: "/operations/requests",
      },
      {
        q: "Get a won request's project started",
        steps: [
          "The project is started by the department the request was sent to, not by Operations.",
          "Make sure it's routed to the right department and assigned to someone there.",
          "When it's **Won**, they click **Start project from request** on the card or the request.",
        ],
        to: "/operations/requests",
      },
      {
        q: "Delete a request",
        steps: [
          "Click the bin icon in the list on **Requests overview**, or in its side panel on the board, or **Delete request** on the record.",
          "Confirm with **Delete client request**. Its activity is removed too.",
        ],
        to: "/operations/requests",
      },
      {
        q: "Close a request that isn't going ahead",
        steps: [
          "Use **Move to…** and choose **Lost** or **Withdrawn**, or click **Mark as not going ahead** in its side panel on the board.",
          "Type the reason when asked.",
        ],
        to: "/operations/requests",
      },
    ],
    goodToKnow: [
      "Only Operations can log, route and delete requests. Only the department a request is routed to can start its project.",
      "A request has to be routed to a department before it can move stages.",
      "You can still edit or re-route a request after sending it to a department.",
    ],
  },
  {
    key: "finance",
    title: "Finance",
    icon: Wallet,
    accent: "bg-primary/10 text-primary",
    intro:
      "You bill clients, collect what's owed, and keep the CEO informed on revenue, margin and compliance.",
    start: [
      { label: "Invoices & billing", to: "/finance/invoices" },
      { label: "Debtors", to: "/finance/debtors" },
      { label: "Reports", to: "/finance/reports" },
    ],
    howTo: [
      {
        q: "Raise an invoice",
        steps: [
          "Open **Invoices & billing** and click **New invoice**.",
          "Enter the **Invoice number**, pick a **Contract** (it fills in the client) or the **Client**, the dates and the amount before VAT, then click **Create invoice**.",
        ],
        to: "/finance/invoices",
      },
      {
        q: "Record a payment",
        steps: [
          "On **Invoices & billing**, click the banknote icon on the invoice.",
          "Enter the amount received, the **Paid on** date and the **Reference** (M-Pesa code or bank reference), then click **Record payment**.",
        ],
        to: "/finance/invoices",
      },
      {
        q: "Void an invoice raised by mistake",
        steps: [
          "On **Invoices & billing**, click the void icon (a crossed-out circle) on the invoice.",
          "Type the **Reason for voiding** and click **Void invoice**. It stays on record but no longer counts in the totals.",
          "An invoice with payments can't be voided. Open its payments (banknote icon) and click **Remove payment** first.",
          "An invoice with no payments can also be deleted with the bin icon.",
        ],
        to: "/finance/invoices",
      },
      {
        q: "Record a bill or expense",
        steps: [
          "Open **Expenses** and click **New expense**.",
          "Fill in the **Description**, **Category**, amount and **Expense date**, then click **Add expense**.",
          "When you pay it, click the tick icon on the expense, enter the **Paid on** date and reference, and click **Mark expense as paid**.",
        ],
        to: "/finance/expenses",
      },
      {
        q: "Log a debtor follow-up",
        steps: [
          "Open **Debtors**. Under **Unpaid invoices**, click **Log follow-up** on the invoice.",
          "Choose **What happened**, for example **Promised to pay** (then pick the **Promised date**), and the **Channel**.",
          "Add **Notes** and click **Log follow-up**. Earlier follow-ups show below, and you can answer one with Reply to (their name).",
        ],
        to: "/finance/debtors",
      },
      {
        q: "Set a budget",
        steps: [
          "Open **Budgets** and click **New budget**.",
          "Choose **Budget for** a department or a contract, fill in the period and amount, then click **Create budget**.",
        ],
        to: "/finance/budgets",
      },
      {
        q: "Track payroll filing deadlines",
        steps: [
          "Open **Payroll compliance** and click **New filing**. Pick the **Client**, **Filing**, **Payroll month** and **Due date**, then click **Add filing**.",
          "When it's filed, click **Mark filed**, enter the **Filed on** date and click **Mark as filed**.",
        ],
        to: "/finance/payroll-compliance",
      },
      {
        q: "Import invoices and payments from Excel",
        steps: [
          "Open **Upload from Excel** and click **Download template**.",
          "Fill it in and click **Choose Excel file**.",
          "Check the preview, then click the import button, e.g. **Import 25 invoices**. Clients that don't exist yet are created for you.",
        ],
        to: "/finance/upload",
      },
      {
        q: "Send a report to the CEO",
        steps: [
          "Open **Reports** and click **New finance report**.",
          "Pick the period, write the **Finance commentary**, and click **Save as draft** or **Submit to CEO**.",
          "The CEO approves it or requests changes. Use **Export PDF** to share a copy.",
        ],
        to: "/finance/reports",
      },
      {
        q: "Fix a report the CEO sent back",
        steps: [
          "Open the report marked **Changes requested** and read the CEO's note at the top.",
          "Click **Update & resubmit**, edit the title or commentary, and tick **Refresh the figures with the latest invoices and payments** if the numbers changed.",
          "Click **Resubmit to CEO**. You can also **Save changes** and resubmit later.",
        ],
        to: "/finance/reports",
      },
    ],
    goodToKnow: [
      "Only people allowed to raise invoices (Finance, unless the CEO changes it) can raise invoices and record payments, including from the Projects board.",
      "Only invoices linked to a contract count against a budget.",
      "Revenue & margin is built from invoices, so keep invoices up to date.",
    ],
  },
  {
    key: "it",
    title: "IT",
    icon: Cpu,
    accent: "bg-warning/10 text-warning",
    intro:
      "You deliver systems and HRMS licensing for clients, support users, and keep a register of AMSOL's systems and hardware.",
    start: [
      { label: "Tickets", to: "/it/tickets" },
      { label: "HRMS clients", to: "/it/hrms-clients" },
      { label: "Inventory", to: "/it/inventory" },
    ],
    howTo: [
      {
        q: "Handle a ticket",
        steps: [
          "Open **IT work** → **Tickets** and click the ticket. Use the Me or Not assigned filter to find the ones waiting.",
          "Pick who handles it in **Assign to**, or click **Assign ticket to me**.",
          "Update progress with **Move to…**: **Open**, **In progress**, **Resolved** or **Closed**. You can also drag the card on the **Board**.",
          "Write to the person who asked in **Messages** and click **Send message**.",
        ],
        to: "/it/tickets",
      },
      {
        q: "Log a ticket for someone who called or emailed",
        steps: [
          "Open **Tickets** and click **New ticket**.",
          "Add the **Title**, **Description**, **Priority** and **Where it came from**, pick who it's **Asked by** and **Assign to**, then click **Create ticket**.",
        ],
        to: "/it/tickets",
      },
      {
        q: "Register a website or system",
        steps: [
          "Open **Systems & sites** and click **New system or site**.",
          "Fill in the **Name**, **Type** and **Status**, then click **Add system or site**.",
        ],
        to: "/it/systems-sites",
      },
      {
        q: "Manage an HRMS licence",
        steps: [
          "Open **HRMS clients** and click **New license**.",
          "Pick the **Client**, **Tier** and **Status**, then click **Add license**. Each client has one licence.",
        ],
        to: "/it/hrms-clients",
      },
      {
        q: "Record hardware",
        steps: [
          "Open **Inventory** and click **New inventory item**. The **Asset tag** and **Device name** are required. Click **Add inventory item**.",
          "Click **Export PDF** for a printable register.",
        ],
        to: "/it/inventory",
      },
      {
        q: "Track a system development project",
        steps: [
          "Open the project. On **Overview**, click **Track system development stages**.",
          "Move it through the stages with **Move to stage** as the work progresses.",
        ],
        to: "/projects",
      },
    ],
    goodToKnow: [
      "Anyone can ask IT for help from the account menu. Only IT staff can create, assign, move or delete tickets.",
      "People can change their own request until IT starts on it.",
    ],
  },
  {
    key: "marketing",
    title: "Marketing",
    icon: Megaphone,
    accent: "bg-accent/10 text-accent",
    intro:
      "You find and nurture leads, pass sales-ready ones to the business as client requests, publish the company blog and track the website.",
    start: [
      { label: "Leads", to: "/marketing/leads" },
      { label: "Blog", to: "/marketing/blog" },
      { label: "Website analytics", to: "/marketing/website-analytics" },
    ],
    howTo: [
      {
        q: "Capture and work a lead",
        steps: [
          "Open **Leads** and click **Add lead**. Fill in the details and click **Add lead**.",
          "Open the lead to change its stage with **Move to stage**, and record calls and emails with **Log activity**.",
        ],
        to: "/marketing/leads",
      },
      {
        q: "Hand a lead to the business",
        steps: [
          "Open the lead and click **Convert to client request**.",
          "Pick the **Department** to send it straight there, or leave **Let Operations route it**. Click **Convert to client request**.",
          "A lead can only be converted once.",
        ],
        to: "/marketing/leads",
      },
      {
        q: "Write and publish a blog post",
        steps: [
          "Open **Blog**, click **New post**, give it a **Title** and click **Save draft**.",
          "Write the post. Use the toolbar for **Normal text**, **Heading 2**, **Heading 3**, **Quote**, links, lists, tables and colours.",
          "Add an **Excerpt** and click **Upload image**, then click **Save post**.",
          "Check it with **Preview post**, then click **Publish post**.",
        ],
        to: "/marketing/blog",
      },
      {
        q: "Fix messy formatting in a post",
        steps: [
          "Click into the paragraph (or select the text) and click **Clear formatting**.",
          "To remove a link, click inside it and click **Remove link**.",
        ],
        to: "/marketing/blog",
      },
      {
        q: "Run a campaign",
        steps: [
          "Open **Campaigns**, click **New campaign**, fill it in and click **Add campaign**.",
        ],
        to: "/marketing/campaigns",
      },
      {
        q: "Check website performance",
        steps: [
          "Open **Website analytics**. Click **Sync website analytics** for the latest figures.",
        ],
        to: "/marketing/website-analytics",
      },
    ],
    goodToKnow: [
      "Publishing uses the last saved version, so click Save post first.",
      "A post needs an excerpt and content before it can be published.",
    ],
  },
  {
    key: "water",
    title: "Water Project",
    icon: Droplets,
    accent: "bg-primary/10 text-primary",
    intro:
      "You keep the water network's records up to date — zones, meters, customers and readings — and upload usage files for analytics.",
    start: [
      { label: "Meters Registry", to: "/water/meters" },
      { label: "Bulk & Main Readings", to: "/water/readings" },
      { label: "Upload usage file", to: "/water/upload" },
    ],
    howTo: [
      {
        q: "Add a zone",
        steps: [
          "Open **Zones** and click **Add zone**.",
          "Type the **Name** and pick a **Parent zone (optional)**, or leave it as a top-level zone. Click **Add zone**.",
        ],
        to: "/water/zones",
      },
      {
        q: "Register a meter (main, bulk or household)",
        steps: [
          "Open **Meters Registry** and click **Add meter**.",
          "Choose the **Type**, then fill in the **Meter number**, zone and — for household meters — the **Customer assigned**. Click **Add meter**.",
        ],
        to: "/water/meters",
      },
      {
        q: "Add a customer",
        steps: [
          "Open **Customers**, click **Add customer**, fill in their details and click **Add customer**.",
        ],
        to: "/water/customers",
      },
      {
        q: "Record a bulk or main meter reading",
        steps: [
          "Open **Bulk & Main Readings** and click **Record reading** (or **Record reading** on a main or bulk meter's own page).",
          "Pick the **Meter**, the **Reading date & time** and the **Reading value (m³)**.",
          "Click **Record reading**, or **Save and record another** to keep going.",
        ],
        to: "/water/readings",
      },
      {
        q: "Find a meter, customer, zone or reading",
        steps: [
          "Every page has a search box — for example meter number, name, location, plot or customer on **Meters Registry**.",
          "On **Bulk & Main Readings**, filter by meter type, zone and dates as well.",
        ],
        to: "/water/meters",
      },
      {
        q: "Edit or delete a record",
        steps: [
          "Click the pencil icon to edit or the bin icon to delete on any list, or use **Edit meter** / **Delete meter** (or **Edit customer** / **Delete customer**) on its page.",
          "Deleting a meter also deletes its readings. To keep the history, edit it and switch it to **Inactive (not in use)** instead.",
        ],
        to: "/water/meters",
      },
      {
        q: "Upload an mPaya or Amsol file",
        steps: [
          "Open **Upload usage file** and click **Upload usage file**, or drag the CSV or Excel file onto the box.",
          "AIMS tells you if it's an **mPaya payments export** or an **Amsol usage CSV**. Check **Payments to add**, **File's total amount** and **Rows skipped**.",
          "Check **New meters that will be created** for typos. Each new number becomes a household meter.",
          "Click the add button, e.g. **Add 120 payments and 2 new meters**. Nothing is saved before this.",
          "Uploaded the wrong file? Click its bin icon in **Upload history**. Its payments are removed; meters it created stay.",
        ],
        to: "/water/upload",
      },
    ],
    goodToKnow: [
      "A zone that still has meters, customers or sub-zones can't be deleted until they're moved.",
      "Readings are only for main and bulk meters; household usage comes from uploads.",
      "Set a meter to Inactive when it is no longer in use. It keeps its history but takes no new readings and is left out of active counts. Linking a replacement meter does this for you.",
    ],
  },
  {
    key: "ceo_admin",
    title: "CEO",
    icon: Crown,
    accent: "bg-secondary text-secondary-foreground",
    intro:
      "You see every department's numbers and work, approve department reports, and decide who can use which part of AIMS.",
    start: [
      { label: "Dashboard", to: "/dashboard" },
      { label: "Projects & Work", to: "/projects" },
      { label: "Staff", to: "/admin/users" },
    ],
    howTo: [
      {
        q: "See the business at a glance",
        steps: [
          "Open **Dashboard** for revenue against target, pipeline and project analytics.",
          "Use the **Documents** and **Calendar** buttons at the top of the Dashboard.",
        ],
        to: "/dashboard",
      },
      {
        q: "Follow client requests, tenders and projects",
        steps: [
          "Open **Pipelines** and pick **Client requests**, **Tenders** or **Projects board**.",
        ],
        to: "/pipeline/engagements",
      },
      {
        q: "See each department's projects",
        steps: [
          "Open **Projects & Work** → **All projects** and click a department tab for its project list.",
          "Click **Board view** to see every project by delivery stage.",
          "**Water Project** and **Inventory** are also under **Projects & Work**.",
        ],
        to: "/projects",
      },
      {
        q: "Approve a department or Finance report",
        steps: [
          "Open **Reports & Analytics** → **All reports**. The **Waiting for you** tab lists reports sent to you.",
          "Click **Review report**, then **Approve report**, or write a note and click **Request changes**.",
          "Talk it through with the department in **Conversation with the CEO** on the report.",
        ],
        to: "/reports",
      },
      {
        q: "Add a new staff member",
        steps: [
          "Open **Admin** → **Staff** and click **New staff member**.",
          "Enter their **Work email**, pick their **Department** and **Roles**, then click **Add staff member**.",
          "They get an email to set a password. Use **Resend invite** if it didn't arrive.",
        ],
        to: "/admin/users",
      },
      {
        q: "Change one person's View or Edit access",
        steps: [
          "Open **Admin** → **Roles & Permissions**. Under **View / Edit access for each person**, choose the **Department**.",
          "Click the person's **View** or **Edit** button to allow or block it just for them. Click again to go back to their role.",
          "To let someone outside the department work on one client request or tender, open it and click **Share request** or **Share tender**.",
        ],
        to: "/admin/permissions",
      },
      {
        q: "Set what each role can do",
        steps: [
          "Open **Admin** → **Roles & Permissions**.",
          "In **What each role can do**, switch a box on or off, for example let **Account Manager** **Raise invoices and record payments**. It saves straight away.",
        ],
        to: "/admin/permissions",
      },
      {
        q: "Manage departments, offices and service lines",
        steps: [
          "Open **Admin** → **Departments & Offices**. Use **New department**, **New office** or **New service line**.",
        ],
        to: "/admin/departments",
      },
      {
        q: "Read the audit log",
        steps: [
          'Open **Admin** → **Audit Log**. Each line says who did what, for example "Faith voided invoice INV-104".',
          "Filter by **Person**, **Area**, **From** and **To**, or **Search**, then click **Export to Excel** for auditors.",
        ],
        to: "/admin/audit",
      },
      {
        q: "Set the support contact",
        steps: [
          "Open **Admin** → **Company settings**.",
          "Under **Support contact**, enter the **Name** and **Email** staff should contact. They show on the sign-in and password pages.",
          "Click **Save company settings**.",
        ],
        to: "/admin/company",
      },
    ],
    goodToKnow: [
      "Documents open from the Dashboard, the Projects page and Clients & contracts, with a tab for each department.",
      "You can open, edit and delete records in every department.",
    ],
  },
];

export const EVERYONE_HOW_TO: HowTo[] = [
  {
    q: "See what's waiting on you",
    steps: [
      "Open **Home** in the menu. **Your work** at the top lists what's waiting on you: tasks, client requests and tickets given to you, reports to send and projects needing attention.",
      "Click any line to open it.",
      "Open **My tasks** in the menu for every task assigned to you, as a **List** or **Board**.",
    ],
    to: "/projects/mine",
  },
  {
    q: "Reply to a message",
    steps: [
      "Every **Activity**, **Comments**, **Follow-ups** and **Messages** list, and each report's **Conversation with the CEO**, lets you answer a message directly.",
      "Under the message, click Reply to (their name), for example **Reply to Faith**.",
      "Type your answer and click **Send reply**. It shows under their message.",
    ],
    to: "/notifications",
  },
  {
    q: "Start a project from a won client request",
    steps: [
      "Only the department a request was routed to can do this. Open **Client requests** in the menu and open the request.",
      "Move it to **Won**. AIMS asks **Start the project now?** Click **Start project from request**, or **Later**.",
      "Chose Later? Click **Start project from request** on the card or the request.",
      "Confirm the **Client** (or choose **Create new client**), the **Project name** and **Start date**. Switch on **Also create a recurring contract** if the work is billed regularly.",
      "Click **Start project from request**. You land inside the new project.",
    ],
    to: "/pipeline/engagements",
  },
  {
    q: "Edit or delete a project",
    steps: [
      "Click the pencil or bin icon on the project in any project list, or **Edit project** / **Delete project** on the project itself.",
      "Only people in the project's department can change it.",
    ],
    to: "/projects",
  },
  {
    q: "Find something quickly",
    steps: [
      "Use the search box at the top of every page, or press **Ctrl K**.",
      "Click the ? button at the top, or **Help** in the account menu, to open this guide.",
    ],
  },
  {
    q: "Add a client or contract for your department",
    steps: [
      "Open **Clients & contracts** in the menu and click **New client** or **New contract**.",
      "A contract needs a **Contract number**, **Title**, **Client** and **Start date**.",
    ],
    to: "/clients",
  },
  {
    q: "Upload a document",
    steps: [
      "Open **Documents** and click **Upload document**.",
      "Choose what it belongs to in **Attach to**, pick the record, choose the **File** and click **Attach file**.",
      "On a project, client request or tender, you can also use its **Documents** tab.",
    ],
    to: "/documents",
  },
  {
    q: "Add a policy or template to your department's library",
    steps: [
      "Open **Documents** (in your department's work menu) and click **Upload document**.",
      "In **Attach to**, choose **Department library (not tied to a record)**, then pick your department under **Which department?**",
      "Choose the **File**, set **Who can see this file**, then click **Add to library**.",
    ],
    to: "/documents",
  },
  {
    q: "Add an event to the calendar",
    steps: [
      "Open **Calendar** (in your department's work menu, or on the CEO Dashboard) and click **New event**, or click a day.",
      "Fill in the **Title** and **Date**, set the times or switch on **All day**, and choose **Who can see this**.",
      "Click **Add event**.",
    ],
    to: "/calendar",
  },
  {
    q: "Ask IT for help and follow your request",
    steps: [
      "Open the account menu (your name, top right) and click **Ask IT for help**.",
      "Click **Ask IT for help**, fill in **What's the problem?** and **Details**, pick **How urgent?** and click **Send to IT**.",
      "Your request shows under **My requests** with its status. Open it to read IT's replies in **Messages** and answer with **Send message**.",
    ],
    to: "/it-help",
  },
  {
    q: "Choose how alerts reach you",
    steps: [
      "Open the account menu (your name, top right) and click **My notifications**.",
      "For each kind of alert, switch **In AIMS**, **Email**, **SMS** or **WhatsApp** on or off. It saves straight away.",
      "To stop an alert for a while, click **Mute** on its row and pick 1 day, 1 week or a date. It comes back on by itself.",
      "Going away? Click **Pause all alerts** at the top, and **Turn alerts back on** when you're back.",
      "SMS and WhatsApp need a phone number. Add it in **My profile**.",
    ],
    to: "/settings/notifications",
  },
  {
    q: "Change your password or phone number",
    steps: [
      "Open the account menu (your name, top right) and click **My profile**.",
      "Update your **Phone number** and click **Save profile**.",
      "Under **Change password**, fill in **Current password**, **New password** and **Type the new password again**, then click **Change password**.",
    ],
    to: "/settings/profile",
  },
  {
    q: "Forgot your password",
    steps: [
      "On the sign-in page, click **Forgot password?**.",
      "Type your **Work email** and click **Send reset link**.",
      "Open the email, follow the link, choose a new password and click **Set password and sign in**.",
    ],
    to: "/forgot-password",
  },
];

export const GLOSSARY: { term: string; meaning: string }[] = [
  {
    term: "Service line",
    meaning:
      "A kind of service AMSOL sells, such as Recruitment or Payroll. Every department has its own.",
  },
  {
    term: "One-off / Recurring",
    meaning:
      "One-off work has an end date. Recurring work carries on for the client, like a retainer.",
  },
  {
    term: "Client request",
    meaning:
      "A company asking AMSOL for work. Operations logs it and routes it to a department, which works it through to Won or Lost.",
  },
  {
    term: "Tender",
    meaning:
      "A formal bid for work, prepared by the Tender team. Awarded tenders are forwarded to a department as projects.",
  },
  {
    term: "Activity",
    meaning:
      "The log of calls, emails, meetings and notes on a client request, tender, project or lead. People can reply to each entry.",
  },
  {
    term: "Contract",
    meaning:
      "Optional. Add one when the work is billed under a signed agreement; invoices are raised against it.",
  },
  {
    term: "Prospect",
    meaning: "A company that isn't a client in AIMS yet, recorded by name only.",
  },
  {
    term: "Non-revenue water (NRW)",
    meaning:
      "Water that leaves the main meter but isn't paid for, for example through leaks, theft or faulty meters.",
  },
  {
    term: "MRR",
    meaning: "Monthly recurring revenue: what active recurring contracts bring in each month.",
  },
  {
    term: "DSO",
    meaning: "Days to get paid: the average age, in days, of unpaid invoices.",
  },
  {
    term: "Start here",
    meaning:
      "A welcome box on your home page in your first two weeks, with three things to do first. Click Hide this to remove it.",
  },
  {
    term: "Your work",
    meaning:
      "The section at the top of your home page listing what's waiting on you: tasks, requests, tickets, reports and projects needing attention.",
  },
];
