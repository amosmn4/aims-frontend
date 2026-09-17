import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export interface CompanySettings {
  companyName: string;
  logoDataUrl: string | null;
  currencyCode: string;
  financialYearStartMonth: number;
  timeZone: string;
  reportDueDay: number;
  supportContactName: string | null;
  supportContactEmail: string | null;
  updatedAt: string;
}

export const TIME_ZONES = [
  { value: "Africa/Nairobi", label: "East Africa Time — Nairobi (UTC+3)" },
  { value: "Africa/Kampala", label: "East Africa Time — Kampala (UTC+3)" },
  { value: "Africa/Dar_es_Salaam", label: "East Africa Time — Dar es Salaam (UTC+3)" },
  { value: "Africa/Kigali", label: "Central Africa Time — Kigali (UTC+2)" },
  { value: "Africa/Johannesburg", label: "South Africa Time — Johannesburg (UTC+2)" },
  { value: "Africa/Lagos", label: "West Africa Time — Lagos (UTC+1)" },
  { value: "Europe/London", label: "London (UTC+0/+1)" },
  { value: "UTC", label: "UTC" },
];

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function useCompanySettings() {
  return useQuery({
    queryKey: ["company-settings"],
    staleTime: 5 * 60_000,
    queryFn: () => apiJson<CompanySettings>("/company-settings"),
  });
}

export function useUpdateCompanySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Omit<CompanySettings, "updatedAt">>) =>
      apiJson<CompanySettings>("/company-settings", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => qc.setQueryData(["company-settings"], data),
  });
}
