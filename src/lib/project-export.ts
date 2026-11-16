import { jsPDF } from "jspdf";
import { client, deptName, person, type Project, type Report } from "./data";

export function latestProjectReports(projectId: string, reports: Report[]) {
  return reports
    .filter((r) => r.project === projectId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function createProjectPdf(
  project: Project,
  reports: Report[],
  lookup = { person, client, deptName },
) {
  const pdf = new jsPDF();
  let y = 22;
  const write = (text: string, size = 11, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    const safe = text.replace(/[-–]/g, "-").replace(/[’]/g, "'");
    const lines: string[] = pdf.splitTextToSize(safe, 170);
    for (const line of lines) {
      if (y > 272) {
        pdf.addPage();
        y = 22;
      }
      pdf.text(line, 20, y);
      y += size * 0.48 + 2;
    }
    y += 3;
  };
  pdf.setProperties({ title: `${project.name} - Progress & reports`, author: "Amsol" });
  write("AMSOL / PROJECT PROGRESS", 12, true);
  write(project.name, 20, true);
  write(`Generated ${new Date().toISOString().slice(0, 10)} | Local workspace`, 9);
  write(
    `${project.progress}% complete | ${project.status.replace(/-/g, " ")} | ${project.stage}`,
    12,
    true,
  );
  write(`Due: ${project.due} | Lead: ${lookup.person(project.lead).name}`);
  write(
    `Client: ${project.client ? (lookup.client(project.client)?.name ?? "Internal") : "Internal"}`,
  );
  write(`Departments: ${project.depts.map(lookup.deptName).join(", ")}`);
  write(project.summary);
  y += 5;
  write("LATEST REPORTS", 13, true);
  const latest = latestProjectReports(project.id, reports);
  if (!latest.length) write("No reports submitted for this project yet.");
  for (const report of latest) {
    if (y > 225) {
      pdf.addPage();
      y = 22;
    }
    write(report.title, 12, true);
    write(
      `${report.date} | ${lookup.person(report.author).name} | ${report.reviewed ? "Reviewed by CEO" : "Awaiting review"}`,
      9,
    );
    write(`Progress: ${report.progress || "Not provided"}`);
    write(`Support needs: ${report.blockers || "None reported"}`);
    write(`Next steps: ${report.next || "Not provided"}`);
    if (report.comment) write(`CEO comment: ${report.comment}`);
    y += 5;
  }
  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page);
    pdf.setFontSize(8);
    pdf.text(`Amsol | Confidential | ${page} / ${pdf.getNumberOfPages()}`, 20, 286);
  }
  return pdf;
}

export function downloadProjectPdf(
  project: Project,
  reports: Report[],
  lookup = { person, client, deptName },
) {
  const blob = createProjectPdf(project, reports, lookup).output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-progress.pdf`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
