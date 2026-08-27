import { createFileRoute } from "@tanstack/react-router";
import { SharedProjectsView } from "@/features/projects/shared-with-me";

export const Route = createFileRoute("/_authenticated/tender/shared-projects")({
  head: () => ({ meta: [{ title: "Tender — Shared with me — AIMS" }] }),
  component: SharedProjectsView,
});
