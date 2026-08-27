import { createFileRoute } from "@tanstack/react-router";
import { SharedProjectsView } from "@/features/projects/shared-with-me";

export const Route = createFileRoute("/_authenticated/it/shared-projects")({
  head: () => ({ meta: [{ title: "IT — Shared with me — AIMS" }] }),
  component: SharedProjectsView,
});
