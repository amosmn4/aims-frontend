import { useMutation } from "@tanstack/react-query";
import { apiJson } from "@/production/lib/api-client";
export interface ReadingReview {
  suggestions?:
    | {
        label: string;
        explanation: string;
        patch: Record<string, string | number | null>;
      }[]
    | undefined;
  warnings: {
    code: string;
    severity: "warning" | "danger";
    message: string;
  }[];
  reviewToken: string;
  meter: {
    id: string;
    meterNumber: string;
    meterType: string;
  };
}
export function useReadingReview() {
  return useMutation({
    mutationFn: (input: {
      meterId: string;
      readingDate: string;
      value: number | null;
      cumulativeUsage?: number | null | undefined;
      excludeId?: string | undefined;
    }) =>
      apiJson<ReadingReview>("/water/readings/review", {
        method: "POST",
        body: JSON.stringify({ ...input, readingDate: new Date(input.readingDate).toISOString() }),
      }),
  });
}
