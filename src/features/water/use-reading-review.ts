import { useMutation } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export interface ReadingReview {
  warnings: { code: string; severity: "warning" | "danger"; message: string }[];
  reviewToken: string;
  meter: { id: string; meterNumber: string; meterType: string };
}

export function useReadingReview() {
  return useMutation({
    mutationFn: (input: {
      meterId: string;
      readingDate: string;
      value: number | null;
      cumulativeUsage?: number | null;
      excludeId?: string;
    }) =>
      apiJson<ReadingReview>("/water/readings/review", {
        method: "POST",
        body: JSON.stringify({ ...input, readingDate: new Date(input.readingDate).toISOString() }),
      }),
  });
}
