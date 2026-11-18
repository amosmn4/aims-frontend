import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getWorkspace,
  removeRecord,
  saveRecord,
  seedWorkspace,
  STORAGE_KEY,
  updateWorkspace,
  validateRelationships,
} from "@/lib/workspace";
import { searchProjects } from "@/lib/project-search";
import { canSeeBusiness, canReadBusinessFinance } from "@/lib/business";
import { createProjectPdf } from "@/lib/project-export";

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
});

describe("shared workspace persistence", () => {
  it("blocks deletion of linked records and allows deletion of unlinked records", () => {
    expect(() => removeRecord("clients", "c1")).toThrow("existing staff and clients");
    saveRecord("clients", {
      id: "disposable",
      name: "Disposable",
      contact: "Contact",
      services: ["Training"],
    });
    removeRecord("clients", "disposable");
    expect(getWorkspace().clients.some((client) => client.id === "disposable")).toBe(false);
  });
  it("preserves saved records with invalid relationships instead of overwriting them", () => {
    const broken = seedWorkspace();
    broken.projects[0]!.lead = "missing-person";
    const saved = JSON.stringify(broken);
    localStorage.setItem(STORAGE_KEY, saved);
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    expect(() => updateWorkspace((previous) => previous)).toThrow("could not be read");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
  });
  it("starts with a valid and consistently linked sample workspace", () => {
    expect(() => validateRelationships(seedWorkspace())).not.toThrow();
    expect(
      getWorkspace().documents.every((doc) => doc.sample && doc.name.endsWith("(sample).pdf")),
    ).toBe(true);
  });
  it("persists edits and reloads external browser changes", () => {
    const client = getWorkspace().clients[0]!;
    saveRecord("clients", { ...client, name: "Updated client" });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).clients[0]?.name).not.toBeUndefined();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    saved.clients.find((row: { id: string }) => row.id === client.id).name =
      "Changed in another tab";
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    expect(getWorkspace().clients.find((row) => row.id === client.id)?.name).toBe(
      "Changed in another tab",
    );
  });
  it("rejects invalid assignments without partially saving", () => {
    const previous = getWorkspace();
    expect(() => saveRecord("tasks", { ...previous.tasks[0]!, assignee: "p1" })).toThrow(
      "member of their project",
    );
    expect(getWorkspace()).toBe(previous);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
  it("accepts zero finances and multiple dated records for one month", () => {
    saveRecord("businessFinance", {
      id: "zero",
      business: "b0",
      month: "2027-01",
      date: "2027-01-02",
      description: "Opening entry",
      revenue: 0,
      expenses: 0,
    });
    expect(getWorkspace().businessFinance.find((row) => row.id === "zero")?.revenue).toBe(0);
    saveRecord("businessFinance", {
      id: "second",
      business: "b0",
      month: "2027-01",
      date: "2027-01-03",
      description: "Second entry",
      revenue: 1,
      expenses: 0,
    });
    expect(getWorkspace().businessFinance.filter((row) => row.month === "2027-01")).toHaveLength(2);
  });
  it("preserves records if browser storage is full", () => {
    const previous = getWorkspace();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => saveRecord("clients", { ...previous.clients[0]!, name: "Unsaved" })).toThrow(
      "not saved",
    );
    expect(getWorkspace()).toBe(previous);
  });
  it("does not overwrite unreadable saved data", () => {
    localStorage.setItem(STORAGE_KEY, "{invalid");
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    expect(() => updateWorkspace((previous) => previous)).toThrow("could not be read");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("{invalid");
  });
  it("keeps an active CEO and prevents duplicate account email addresses", () => {
    expect(() =>
      updateWorkspace((previous) => ({
        ...previous,
        accounts: previous.accounts.map((account) => ({ ...account, active: false })),
      })),
    ).toThrow("active CEO");
    expect(() =>
      updateWorkspace((previous) => ({
        ...previous,
        accounts: [...previous.accounts, { ...previous.accounts[0]!, id: "duplicate" }],
      })),
    ).toThrow("email address");
  });
});

describe("current data and business visibility", () => {
  it("keeps a staff business grant scoped to that business", () => {
    const data = seedWorkspace();
    const visible = data.businesses.filter((business) =>
      canSeeBusiness(business, "staff", "p6", "it", { home: null, granted: ["b1"] }),
    );
    expect(visible.map((business) => business.id)).toEqual(["b0", "b1"]);
    expect(
      data.businessFinance
        .filter((row) =>
          canReadBusinessFinance("staff", row.business, {
            home: null,
            granted: ["b1"],
            permissions: [{ person: "p6", business: "b1", finance: "view" }],
          }),
        )
        .every((row) => row.business === "b1"),
    ).toBe(true);
  });
  it("searches current reports and returns only reports with blockers for support searches", () => {
    const data = seedWorkspace();
    const report = {
      ...data.reports[0]!,
      id: "new",
      title: "Current locally saved update",
      blockers: "New test issue",
    };
    const results = searchProjects("blockers", data.projects, [...data.reports, report]);
    expect(results.reports.some((item) => item.id === "new")).toBe(true);
    expect(results.reports.every((item) => !!item.blockers)).toBe(true);
  });
  it("exports updated client and staff names in project PDFs", () => {
    const data = seedWorkspace();
    const project = data.projects[0]!;
    const output = createProjectPdf(project, data.reports, {
      person: (id) => ({ id, name: "Updated staff name", title: "", dept: null }),
      client: (id) => ({ id, name: "Updated client name", services: [], contact: "" }),
      deptName: () => "Updated department",
    }).output();
    expect(output).toContain("Updated staff name");
    expect(output).toContain("Updated client name");
    expect(output).toContain("Updated department");
  });
});
