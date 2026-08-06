import { createFileRoute } from "@tanstack/react-router";
import { SharedProjectsView } from "@/features/projects/shared-with-me";

export const Route = createFileRoute("/_authenticated/operations/shared-projects")({
  head: () => ({ meta: [{ title: "Operations — Shared with me — AIMS" }] }),
  component: SharedProjectsView,
});
