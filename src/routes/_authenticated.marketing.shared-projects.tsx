import { createFileRoute } from "@tanstack/react-router";
import { SharedProjectsView } from "@/features/projects/shared-with-me";

export const Route = createFileRoute("/_authenticated/marketing/shared-projects")({
  head: () => ({ meta: [{ title: "Marketing — Shared with me — AIMS" }] }),
  component: SharedProjectsView,
});
