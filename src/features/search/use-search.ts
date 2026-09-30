import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  to: string;
}

export const SEARCH_TYPE_LABELS: Record<string, string> = {
  lead: "Lead",
  client_request: "Client Request",
  tender: "Tender",
  project: "Project",
  contract: "Contract",
  client: "Client",
  blog_post: "Blog Post",
  it_system: "System & Site",
  ticket: "IT Ticket",
  campaign: "Campaign",
  invoice: "Invoice",
  document: "Document",
};

export function useSearch(query: string) {
  return useQuery({
    queryKey: ["search", query],
    enabled: query.trim().length >= 2,
    queryFn: async () => apiJson<SearchResult[]>(`/search?q=${encodeURIComponent(query.trim())}`),
  });
}
