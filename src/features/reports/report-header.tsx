import { PageHeader } from "@/components/app-shell";
import type { ReactNode } from "react";

/** Top of a department report: what it is, what it's for, and its main action. */
export function ReportHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return <PageHeader title={title} description={description} actions={actions} />;
}
