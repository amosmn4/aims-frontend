import * as XLSX from "xlsx";
import type { UsageUploadRowInput } from "./use-water";
const NAIROBI_OFFSET_MS = 3 * 3600000;
export const MAX_UPLOAD_ROWS = 5000;
export type UsageFileFormat = "mpaya" | "amsol" | "other";
export interface ParsedUsageFile {
  format: UsageFileFormat;
  rows: UsageUploadRowInput[];
  unitsMissing: number;
  totalAmount: number;
  fileTotal: number | null;
  skippedTotalRows: number;
  skippedBlankRows: number;
  skippedInvalidRows: number;
}
const COLUMNS = {
  meter: ["meter", "meter_number", "meter no", "meter number", "account no.", "account"],
  customer: ["customer", "customer_name", "name", "names"],
  amount: ["amount", "amount paid", "amount_paid", "payment"],
  units: ["units", "units_sold", "units sold", "consumption"],
  date: ["created at", "date", "transaction date", "paid at", "recorded_at", "period"],
} as const;
type Column = keyof typeof COLUMNS;
function cell(row: Record<string, unknown>, column: Column): unknown {
  const names: readonly string[] = COLUMNS[column];
  const key = Object.keys(row).find((k) => names.includes(k.trim().toLowerCase()));
  return key === undefined ? undefined : row[key];
}
const isBlank = (value: unknown) =>
  value === undefined || value === null || (typeof value === "string" && value.trim() === "");
const text = (value: unknown) => (isBlank(value) ? "" : String(value).trim());
export function excelSerialToDate(serial: number): Date {
  return new Date(Math.round((serial - 25569) * 86400000) - NAIROBI_OFFSET_MS);
}
function meterNumberOf(value: unknown): string {
  if (typeof value === "number") return Number.isFinite(value) ? String(Math.round(value)) : "";
  return text(value);
}
function numberOf(value: unknown): number {
  if (typeof value === "number") return value;
  return Number(text(value).replace(/,/g, ""));
}
function dateOf(value: unknown): Date | null {
  let d: Date | null = null;
  if (value instanceof Date) {
    d = new Date(value.getTime() - NAIROBI_OFFSET_MS);
  } else if (typeof value === "number") {
    d = value > 0 ? excelSerialToDate(value) : null;
  } else if (typeof value === "string" && value.trim()) {
    const t = value.trim();
    d = /^\d+(\.\d+)?$/.test(t)
      ? excelSerialToDate(Number(t))
      : new Date(t.replace(/(\.\d{3})\d+/, "$1"));
  }
  return d && !Number.isNaN(d.getTime()) ? d : null;
}
function detectFormat(rows: Record<string, unknown>[]): UsageFileFormat {
  const headers = new Set(Object.keys(rows[0] ?? {}).map((k) => k.trim().toLowerCase()));
  if (headers.has("created at")) return "amsol";
  if (headers.has("date") && headers.has("meter")) return "mpaya";
  return "other";
}
export function parseUsageRows(sheetRows: Record<string, unknown>[]): ParsedUsageFile {
  const result: ParsedUsageFile = {
    format: detectFormat(sheetRows),
    rows: [],
    unitsMissing: 0,
    totalAmount: 0,
    fileTotal: null,
    skippedTotalRows: 0,
    skippedBlankRows: 0,
    skippedInvalidRows: 0,
  };
  for (const row of sheetRows) {
    const meterCell = cell(row, "meter");
    const amountCell = cell(row, "amount");
    const dateCell = cell(row, "date");
    const labels = [meterCell, cell(row, "customer"), dateCell].map((v) => text(v).toUpperCase());
    if (labels.some((l) => l === "TOTAL" || l === "TOTALS")) {
      result.skippedTotalRows++;
      const total = numberOf(amountCell);
      if (!isBlank(amountCell) && Number.isFinite(total)) result.fileTotal = total;
      continue;
    }
    const meterNumber = meterNumberOf(meterCell);
    if (!meterNumber || isBlank(amountCell) || isBlank(dateCell)) {
      result.skippedBlankRows++;
      continue;
    }
    const amountPaid = numberOf(amountCell);
    const recordedAt = dateOf(dateCell);
    const unitsCell = cell(row, "units");
    const noUnits = isBlank(unitsCell);
    const unitsSold = noUnits ? 0 : numberOf(unitsCell);
    if (
      !recordedAt ||
      !Number.isFinite(amountPaid) ||
      amountPaid < 0 ||
      !Number.isFinite(unitsSold) ||
      unitsSold < 0
    ) {
      result.skippedInvalidRows++;
      continue;
    }
    if (noUnits) result.unitsMissing++;
    result.totalAmount += amountPaid;
    result.rows.push({
      meterNumber,
      customerName: text(cell(row, "customer")) || `Account ${meterNumber}`,
      unitsSold,
      amountPaid,
      recordedAt: recordedAt.toISOString(),
    });
  }
  return result;
}
export function parseUsageFile(data: ArrayBuffer | Uint8Array, fileName: string): ParsedUsageFile {
  const isText = /\.(csv|txt)$/i.test(fileName);
  const wb = XLSX.read(data, { type: "array", cellDates: false, raw: isText });
  const name = wb.SheetNames[0];
  const ws = name ? wb.Sheets[name] : undefined;
  const sheetRows = ws ? XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" }) : [];
  return parseUsageRows(sheetRows);
}
