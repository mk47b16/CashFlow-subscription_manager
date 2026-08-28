export type Category = "Income" | "Housing" | "Utilities" | "Food" | "Shopping" | "Transport" | "Entertainment" | "Transfer" | "Health" | "Other";

const CATEGORIES: readonly Category[] = ["Income", "Housing", "Utilities", "Food", "Shopping", "Transport", "Entertainment", "Transfer", "Health", "Other"];

/** Runtime guard that narrows an unknown string to a valid Category, falling back to "Other". */
export function asCategory(value: string): Category {
  return (CATEGORIES as readonly string[]).includes(value) ? (value as Category) : "Other";
}

/** Runtime guard that narrows an unknown string to "debit" | "credit", falling back to "debit". */
export function asKind(value: string): "debit" | "credit" {
  return value === "credit" ? "credit" : "debit";
}

export type Transaction = {
  id: string; date: string; merchant: string; amount: number; category: Category;
  kind: "debit" | "credit"; engagementDays?: number;
};

export type SubscriptionStatus = "active" | "price increased" | "possibly unused" | "duplicate" | "learning";
export type Subscription = {
  id: string; canonical: string; members: Transaction[]; confidence: number; frequency: "weekly" | "monthly" | "quarterly" | "yearly";
  averageAmount: number; lastCharged: string; nextExpected: string; annualized: number; status: SubscriptionStatus;
  engagementDays: number; duplicateLikelihood: number; priceIncrease: boolean; description: string; classification?: "Essential" | "Shared expense" | "Subscription" | "Review later";
};

export type Anomaly = { transaction: Transaction; score: number; reasons: string[]; categoryMedian: number; merchantNovelty: number };
