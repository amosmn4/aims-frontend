export const WATER_EXPENSE_CATEGORY_LABELS = {
  electricity: "Electricity / pumping",
  maintenance: "Maintenance",
  repairs: "Repairs",
  equipment: "Equipment",
  staff: "Staff costs",
  other: "Other",
} as const;

export type WaterExpenseCategory = keyof typeof WATER_EXPENSE_CATEGORY_LABELS;

export interface WaterExpenseTotals {
  recorded: number;
  paid: number;
  unpaid: number;
  count: number;
  categories: {
    category: WaterExpenseCategory;
    recorded: number;
    paid: number;
    unpaid: number;
    count: number;
  }[];
}

export interface WaterExpenseRow {
  id: string;
  expenseDate: string;
  waterCategory: WaterExpenseCategory;
  description: string;
  amount: number;
  currencyCode: string;
  supplier: string | null;
  reference: string | null;
  status: "paid" | "unpaid";
  paidOn: string | null;
}

export interface WaterExpenseInput {
  expenseDate: string;
  category: WaterExpenseCategory;
  description: string;
  amount: number;
  supplier?: string;
  reference?: string;
  paidOn: string | null;
}

export function waterToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function formatWaterMoney(amount: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
