import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Info } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export interface PublicCompanyInfo {
  companyName: string | null;
  logoDataUrl: string | null;
  supportContactName: string | null;
  supportContactEmail: string | null;
}

export const PUBLIC_COMPANY_INFO_KEY = ["company-settings", "public"] as const;

/** Name, logo and support contact for the sign-in and password pages. */
export function usePublicCompanyInfo() {
  return useQuery({
    queryKey: PUBLIC_COMPANY_INFO_KEY,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: () => apiJson<PublicCompanyInfo>("/company-settings/public"),
  });
}

export function useAuthBrand() {
  const { data, isLoading } = usePublicCompanyInfo();
  return {
    logoSrc: isLoading ? null : data?.logoDataUrl || "/amsol-logo.png",
    companyName: data?.companyName?.trim() || "Amsol",
  };
}

/** Logo, "AIMS" and the company name, for the top of auth pages. */
export function AuthBrand({ className }: { className?: string }) {
  const { logoSrc, companyName } = useAuthBrand();
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-md border bg-white p-1">
        {logoSrc && (
          <img src={logoSrc} alt={`${companyName} logo`} className="h-full w-full object-contain" />
        )}
      </div>
      <div className="leading-tight">
        <div className="font-semibold">AIMS</div>
        <div className="text-xs text-muted-foreground">{companyName}</div>
      </div>
    </div>
  );
}

/** "Need help? Contact {name} at {email}", or the CEO's office when none is set. */
export function SupportContactLine({ className }: { className?: string }) {
  const { data, isLoading } = usePublicCompanyInfo();
  if (isLoading) return null;
  const name = data?.supportContactName?.trim();
  const email = data?.supportContactEmail?.trim();
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Need help?{" "}
      {email ? (
        <>
          Contact {name || "support"} at{" "}
          <a href={`mailto:${email}`} className="font-medium text-primary hover:underline">
            {email}
          </a>
        </>
      ) : name ? (
        `Contact ${name}.`
      ) : (
        "Ask the CEO's office for help."
      )}
    </p>
  );
}

/** A message box above an auth form: "info" for notices, "error" for failures. */
export function AuthNotice({
  tone,
  children,
  className,
}: {
  tone: "info" | "error";
  children: ReactNode;
  className?: string;
}) {
  const Icon = tone === "error" ? AlertCircle : Info;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3 text-sm",
        tone === "error"
          ? "border-destructive/40 bg-destructive/5 text-destructive"
          : "border-primary/30 bg-primary/5 text-foreground",
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
