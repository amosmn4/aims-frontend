import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Building, ImageUp, Loader2, Save, Trash2 } from "lucide-react";
import { RequireRole } from "@/components/require-role";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FormField, RequiredNote } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";
import {
  MONTHS,
  TIME_ZONES,
  useCompanySettings,
  useUpdateCompanySettings,
  type CompanySettings,
} from "@/features/settings/use-company-settings";
import { isEmail } from "@/features/auth/auth-rules";
import { PUBLIC_COMPANY_INFO_KEY } from "@/features/auth/public-company-info";

export const Route = createFileRoute("/_authenticated/admin/company")({
  head: () => ({
    meta: [{ title: "Company settings — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <RequireRole roles={[]} message="Company settings are managed by the CEO.">
      <CompanySettingsPage />
    </RequireRole>
  ),
});

const CURRENCIES = [
  ["KES", "Kenyan Shilling (KES)"],
  ["UGX", "Ugandan Shilling (UGX)"],
  ["TZS", "Tanzanian Shilling (TZS)"],
  ["RWF", "Rwandan Franc (RWF)"],
  ["USD", "US Dollar (USD)"],
  ["EUR", "Euro (EUR)"],
  ["GBP", "British Pound (GBP)"],
];
const MAX_LOGO_BYTES = 500 * 1024;
const selectClass = "h-9 w-full rounded-md border bg-background px-3 text-sm";
const DESCRIPTION =
  "Details that apply across AIMS: name and logo, currency, financial year, when monthly reports are due, and who staff ask for sign-in help.";

type SettingsForm = CompanySettings & {
  supportContactName: string | null;
  supportContactEmail: string | null;
};
type FieldErrors = Partial<
  Record<"companyName" | "supportContactName" | "supportContactEmail", string>
>;

const toForm = (s: CompanySettings): SettingsForm => ({
  ...s,
  supportContactName: s.supportContactName ?? null,
  supportContactEmail: s.supportContactEmail ?? null,
});

const EDITABLE: (keyof SettingsForm)[] = [
  "companyName",
  "logoDataUrl",
  "currencyCode",
  "financialYearStartMonth",
  "timeZone",
  "reportDueDay",
  "reportRemindersEnabled",
  "departmentHeadsReview",
  "supportContactName",
  "supportContactEmail",
];

function CompanySettingsPage() {
  const settingsQ = useCompanySettings();
  const officesQ = useQuery({
    queryKey: ["offices", "with-hq"],
    queryFn: () => apiJson<{ id: string; name: string; isHq: boolean }[]>("/offices"),
  });
  const update = useUpdateCompanySettings();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (settingsQ.data && !form) setForm(toForm(settingsQ.data));
  }, [settingsQ.data, form]);

  const baseline = settingsQ.data ? toForm(settingsQ.data) : null;
  const dirty =
    !!form && !!baseline && EDITABLE.some((k) => (form[k] ?? "") !== (baseline[k] ?? ""));
  useUnsavedChanges(dirty);

  if (!form) {
    return (
      <div className="max-w-3xl space-y-4">
        <PageHeader title="Company settings" description={DESCRIPTION} />
        {settingsQ.isError ? (
          <LoadError
            what="company settings"
            error={settingsQ.error}
            onRetry={() => settingsQ.refetch()}
          />
        ) : (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </div>
    );
  }
  const set = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) =>
    setForm({ ...form, [key]: value });
  const clearError = (key: keyof FieldErrors) => setErrors((e) => ({ ...e, [key]: undefined }));
  const headOffice = officesQ.data?.find((o) => o.isHq);

  const pickLogo = (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
      toast.error("Choose a PNG, JPG, WEBP or SVG image");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("The logo must be smaller than 500 KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set("logoDataUrl", String(reader.result));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    const companyName = form.companyName.trim();
    const supportName = (form.supportContactName ?? "").trim();
    const supportEmail = (form.supportContactEmail ?? "").trim();
    const next: FieldErrors = {};
    if (companyName.length < 2) next.companyName = "Enter the company name.";
    else if (companyName.length > 120) next.companyName = "Keep the name under 120 characters.";
    if (supportName.length > 120) next.supportContactName = "Keep the name under 120 characters.";
    if (supportEmail && !isEmail(supportEmail))
      next.supportContactEmail = "Enter a valid email, like jane@example.com.";
    else if (supportName && !supportEmail)
      next.supportContactEmail = "Add the email staff should write to.";
    if (supportEmail && !supportName)
      next.supportContactName = "Add the name staff should ask for.";
    setErrors(next);
    const firstError = (Object.keys(next) as (keyof FieldErrors)[]).find((k) => next[k]);
    if (firstError) {
      document.getElementById(FIELD_IDS[firstError])?.focus();
      return;
    }

    const payload = {
      companyName,
      logoDataUrl: form.logoDataUrl,
      currencyCode: form.currencyCode,
      financialYearStartMonth: form.financialYearStartMonth,
      timeZone: form.timeZone,
      reportDueDay: form.reportDueDay,
      reportRemindersEnabled: form.reportRemindersEnabled,
      departmentHeadsReview: form.departmentHeadsReview,
      supportContactName: supportName || null,
      supportContactEmail: supportEmail || null,
    };
    try {
      const saved = await update.mutateAsync(payload);
      setForm(toForm(saved));
      qc.invalidateQueries({ queryKey: PUBLIC_COMPANY_INFO_KEY });
      toast.success("Company settings saved");
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (/support contact/i.test(message)) setErrors({ supportContactEmail: message });
      else toast.error(message || "Couldn't save the settings");
    }
  };

  const saveButton = (
    <Button onClick={save} disabled={update.isPending}>
      {update.isPending ? (
        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
      ) : (
        <Save className="mr-1 h-4 w-4" />
      )}
      Save company settings
    </Button>
  );

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Company settings" description={DESCRIPTION} actions={saveButton} />
      <RequiredNote />

      <section className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
        <FormField
          id="company-name"
          label="Company name"
          required
          error={errors.companyName}
          className="sm:col-span-2"
        >
          <Input
            id="company-name"
            value={form.companyName}
            maxLength={120}
            onChange={(e) => {
              set("companyName", e.target.value);
              clearError("companyName");
            }}
            aria-invalid={!!errors.companyName}
            aria-describedby={errors.companyName ? "company-name-error" : undefined}
          />
        </FormField>

        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="company-logo">Logo</Label>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border bg-white">
              {form.logoDataUrl ? (
                <img
                  src={form.logoDataUrl}
                  alt="Company logo"
                  className="h-full w-full object-contain"
                />
              ) : (
                <Building className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <input
              ref={fileRef}
              id="company-logo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="sr-only"
              onChange={(e) => pickLogo(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <ImageUp className="mr-1 h-4 w-4" />{" "}
              {form.logoDataUrl ? "Change logo" : "Upload logo"}
            </Button>
            {form.logoDataUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => set("logoDataUrl", null)}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Remove logo
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            PNG, JPG, WEBP or SVG, up to 500 KB. Used on exported reports and the sign-in page.
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="company-currency">Main currency</Label>
          <select
            id="company-currency"
            className={selectClass}
            value={form.currencyCode}
            onChange={(e) => set("currencyCode", e.target.value)}
          >
            {CURRENCIES.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="company-fy">Financial year starts in</Label>
          <select
            id="company-fy"
            className={selectClass}
            value={form.financialYearStartMonth}
            onChange={(e) => set("financialYearStartMonth", Number(e.target.value))}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="company-tz">Time zone</Label>
          <select
            id="company-tz"
            className={selectClass}
            value={form.timeZone}
            onChange={(e) => set("timeZone", e.target.value)}
          >
            {TIME_ZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="company-due">Monthly reports are due on</Label>
          <select
            id="company-due"
            className={selectClass}
            value={form.reportDueDay}
            onChange={(e) => set("reportDueDay", Number(e.target.value))}
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                Day {d} of the next month
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Departments get a reminder 3 days before, and you're told about any report that's late.
          </p>
        </div>

        <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
          <div>
            <Label htmlFor="company-report-reminders">Send monthly report reminders</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Turn this off to stop the "report due" reminder emails for everyone in the company.
            </p>
          </div>
          <Switch
            id="company-report-reminders"
            checked={form.reportRemindersEnabled}
            onCheckedChange={(v) => set("reportRemindersEnabled", v)}
          />
        </div>

        <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
          <div>
            <Label htmlFor="company-heads-review">
              Department heads read their team&rsquo;s reports
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Off means every report comes to you. Turn it on once you have given people the
              department head role, and their team&rsquo;s own reports and project progress reports
              go to them first. You still see all of them.
            </p>
          </div>
          <Switch
            id="company-heads-review"
            checked={form.departmentHeadsReview}
            onCheckedChange={(v) => set("departmentHeadsReview", v)}
          />
        </div>

        <div className="grid gap-1.5 sm:col-span-2">
          <span className="text-sm font-medium">Head office</span>
          <p className="text-sm">
            {headOffice ? headOffice.name : "No head office set."}{" "}
            <Link to="/admin/departments" className="text-primary hover:underline">
              Change it in Departments &amp; Offices
            </Link>
          </p>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <h2 className="text-sm font-semibold">Support contact</h2>
          <p className="text-xs text-muted-foreground">
            Shown on the sign-in and password pages so staff know who to ask.
          </p>
        </div>
        <FormField id="support-name" label="Name" error={errors.supportContactName}>
          <Input
            id="support-name"
            value={form.supportContactName ?? ""}
            maxLength={120}
            placeholder="e.g. Jane Wanjiku, CEO's office"
            onChange={(e) => {
              set("supportContactName", e.target.value);
              clearError("supportContactName");
            }}
            aria-invalid={!!errors.supportContactName}
            aria-describedby={errors.supportContactName ? "support-name-error" : undefined}
          />
        </FormField>
        <FormField id="support-email" label="Email" error={errors.supportContactEmail}>
          <Input
            id="support-email"
            type="email"
            inputMode="email"
            value={form.supportContactEmail ?? ""}
            placeholder="e.g. help@example.com"
            onChange={(e) => {
              set("supportContactEmail", e.target.value);
              clearError("supportContactEmail");
            }}
            aria-invalid={!!errors.supportContactEmail}
            aria-describedby={errors.supportContactEmail ? "support-email-error" : undefined}
          />
        </FormField>
      </section>

      <div className="flex justify-end">{saveButton}</div>
    </div>
  );
}

const FIELD_IDS: Record<keyof FieldErrors, string> = {
  companyName: "company-name",
  supportContactName: "support-name",
  supportContactEmail: "support-email",
};
