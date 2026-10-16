import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, Save } from "lucide-react";
import { useAuth, type Profile } from "@/lib/auth";
import { apiJson } from "@/lib/api-client";
import { PageHeader } from "@/components/app-shell";
import { FormField, RequiredNote } from "@/components/form-field";
import { useLeaveGuard } from "@/features/settings/use-leave-guard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/settings/profile")({
  head: () => ({ meta: [{ title: "My profile — AIMS" }] }),
  component: ProfilePage,
});

const PHONE_RE = /^\+?[\d\s()-]{9,20}$/;
const errorText = (e: unknown, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback;

function ProfilePage() {
  const { profile } = useAuth();

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader
        title="My profile"
        description="Your name and contact details, and your password."
      />
      {profile ? (
        <DetailsForm profile={profile} />
      ) : (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
      <ChangePasswordForm />
    </div>
  );
}

function DetailsForm({ profile }: { profile: Profile }) {
  const { refresh } = useAuth();
  const [saved, setSaved] = useState(() => ({
    fullName: profile.fullName ?? "",
    phone: profile.phone ?? "",
    jobTitle: profile.jobTitle ?? "",
  }));
  const [form, setForm] = useState(saved);
  const [errors, setErrors] = useState<Partial<Record<"fullName" | "phone", string>>>({});
  const [saving, setSaving] = useState(false);
  const dirty = (Object.keys(saved) as (keyof typeof saved)[]).some((k) => form[k] !== saved[k]);
  useLeaveGuard(dirty);

  const set = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (form.fullName.trim().length < 2) next.fullName = "Enter your full name";
    if (form.phone.trim() && !PHONE_RE.test(form.phone.trim())) {
      next.phone = "Enter a phone number like 0712 345 678 or +254 712 345 678";
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      await apiJson("/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          phone: form.phone.trim() || null,
          jobTitle: form.jobTitle.trim() || null,
        }),
      });
      setSaved(form);
      await refresh();
      toast.success("Profile saved");
    } catch (err) {
      toast.error(errorText(err, "Couldn't save your profile"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={saveProfile} className="space-y-4 rounded-lg border bg-card p-4" noValidate>
      <div>
        <h2 className="text-sm font-semibold">Your details</h2>
        <RequiredNote />
      </div>
      <FormField id="profile-email" label="Email" hint="Ask the CEO if your email needs to change.">
        <Input id="profile-email" value={profile.email} disabled />
      </FormField>
      <FormField id="profile-name" label="Full name" required error={errors.fullName}>
        <Input
          id="profile-name"
          value={form.fullName}
          onChange={(e) => set("fullName", e.target.value)}
          aria-invalid={!!errors.fullName}
          autoComplete="name"
        />
      </FormField>
      <FormField id="profile-job" label="Job title">
        <Input
          id="profile-job"
          value={form.jobTitle}
          onChange={(e) => set("jobTitle", e.target.value)}
        />
      </FormField>
      <FormField
        id="profile-phone"
        label="Phone number"
        error={errors.phone}
        hint="Used for SMS and WhatsApp alerts you switch on."
      >
        <Input
          id="profile-phone"
          type="tel"
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          placeholder="0712 345 678"
          aria-invalid={!!errors.phone}
          autoComplete="tel"
        />
      </FormField>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/settings/notifications" className="text-sm text-primary hover:underline">
          Choose how alerts reach you
        </Link>
        <div className="flex flex-wrap gap-2">
          {dirty && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setForm(saved);
                setErrors({});
              }}
            >
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={saving || !dirty}>
            {saving ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1 h-4 w-4" />
            )}
            Save profile
          </Button>
        </div>
      </div>
    </form>
  );
}

function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Partial<Record<"current" | "next" | "confirm", string>>>({});
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found: typeof errors = {};
    if (!current) found.current = "Enter your current password";
    if (next.length < 8) found.next = "Use at least 8 characters";
    if (confirm !== next) found.confirm = "The two passwords don't match";
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await apiJson("/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password changed");
    } catch (err) {
      const message = errorText(err, "Couldn't change your password");
      if (/current password/i.test(message)) setErrors({ current: message });
      else toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border bg-card p-4" noValidate>
      <div>
        <h2 className="text-sm font-semibold">Change password</h2>
        <RequiredNote />
      </div>
      <FormField id="pw-current" label="Current password" required error={errors.current}>
        <Input
          id="pw-current"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          aria-invalid={!!errors.current}
          autoComplete="current-password"
        />
      </FormField>
      <FormField
        id="pw-new"
        label="New password"
        required
        error={errors.next}
        hint="At least 8 characters."
      >
        <Input
          id="pw-new"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          aria-invalid={!!errors.next}
          autoComplete="new-password"
        />
      </FormField>
      <FormField
        id="pw-confirm"
        label="Type the new password again"
        required
        error={errors.confirm}
      >
        <Input
          id="pw-confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={!!errors.confirm}
          autoComplete="new-password"
        />
      </FormField>
      <div className="flex justify-end">
        <Button type="submit" variant="outline" disabled={saving}>
          {saving ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <KeyRound className="mr-1 h-4 w-4" />
          )}
          Change password
        </Button>
      </div>
    </form>
  );
}
