import { Transaction } from "./types";

const months = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"];
const pad = (n: number) => String(n).padStart(2, "0");
const at = (month: string, day: number) => `${month}-${pad(day)}`;

const recurring = [
  { names: ["NETFLIX.COM", "Netflix Mumbai", "Nflx*Streaming"], amounts: [499, 499, 499, 499, 499, 499, 499, 649, 649, 649], day: 7, category: "Entertainment" as const, engagement: [0,0,0,0,0,0,0,0,0,0] },
  { names: ["Spotify Premium", "SPOTIFY P", "Spotify AB"], amounts: [119,119,119,119,119,119,119,119,119,119], day: 13, category: "Entertainment" as const, engagement: [10,9,15,12,8,13,11,14,8,10] },
  { names: ["Amazon Prime", "AMZN Prime"], amounts: [1499,1499,1499,1499,1499,1499,1499,1499,1499,1499], day: 3, category: "Entertainment" as const, engagement: [4,2,1,3,2,0,1,2,0,1], frequency: "yearly" as const },
  { names: ["YouTube Premium", "YOUTUBE*PREMIUM", "Youtube Premium India"], amounts: [129,129,129,129,129,129,129,129,129,129], day: 17, category: "Entertainment" as const, engagement: [2,0,3,1,0,2,1,0,0,1] },
  { names: ["Notion AI", "NOTION.SO"], amounts: [800,800,800,800,800,800,800,800,800,800], day: 22, category: "Other" as const, engagement: [6,5,7,4,5,4,6,5,4,3] },
  { names: ["Arjun Rent Split", "Arjun UPI Rent", "Flatmate UPI Transfer"], amounts: [14500,14500,14500], day: 2, category: "Transfer" as const, engagement: [30,30,30], start: 7 },
];

const variableFood = ["Swiggy", "Zomato", "Blue Tokai", "Third Wave Coffee", "Local Kirana"];
const transport = ["Uber India", "Namma Yatri", "Delhi Metro", "Rapido"];

export const transactions: Transaction[] = months.flatMap((month, mi) => {
  const result: Transaction[] = [
    { id: `salary-${month}`, date: at(month, 1), merchant: "ACME Labs Salary", amount: 78000, category: "Income", kind: "credit" },
    { id: `rent-${month}`, date: at(month, 5), merchant: "HDFC Rent Transfer", amount: 24000, category: "Housing", kind: "debit" },
    { id: `electric-${month}`, date: at(month, 10), merchant: "BESCOM Electricity", amount: 1600 + (mi % 3) * 180, category: "Utilities", kind: "debit" },
    { id: `wifi-${month}`, date: at(month, 12), merchant: "Airtel Broadband", amount: 999, category: "Utilities", kind: "debit" },
    ...variableFood.flatMap((merchant, i) => [{ id: `food-${month}-${i}`, date: at(month, 8 + i * 4), merchant, amount: 170 + ((mi * 71 + i * 113) % 620), category: "Food" as const, kind: "debit" as const }]),
    ...transport.slice(0, 3).map((merchant, i) => ({ id: `transport-${month}-${i}`, date: at(month, 6 + i * 7), merchant, amount: 95 + ((mi * 47 + i * 39) % 310), category: "Transport" as const, kind: "debit" as const })),
    { id: `shopping-${month}`, date: at(month, 25), merchant: mi % 2 ? "Myntra Online" : "Amazon.in", amount: 650 + ((mi * 281) % 2100), category: "Shopping", kind: "debit" }
  ];
  recurring.forEach((spec, si) => {
    const start = spec.start ?? 0;
    if (mi < start) return;
    if (spec.frequency === "yearly" && mi !== 0) return;
    const ri = mi - start;
    result.push({ id: `rec-${si}-${month}`, date: at(month, spec.day + ((mi + si) % 3) - 1), merchant: spec.names[ri % spec.names.length], amount: spec.amounts[Math.min(ri, spec.amounts.length - 1)], category: spec.category, kind: "debit", engagementDays: spec.engagement[Math.min(ri, spec.engagement.length - 1)] });
  });
  return result;
});

transactions.push(
  { id: "anomaly-electronics", date: "2026-08-19", merchant: "Croma Electronics", amount: 28999, category: "Shopping", kind: "debit" },
  { id: "anomaly-dinner", date: "2026-08-21", merchant: "Olive Bar & Kitchen", amount: 7840, category: "Food", kind: "debit" },
  { id: "anomaly-transfer", date: "2026-08-23", merchant: "UPI Transfer to Rohan", amount: 18500, category: "Transfer", kind: "debit" },
  { id: "recent-1", date: "2026-08-27", merchant: "Blue Tokai", amount: 340, category: "Food", kind: "debit" },
  { id: "recent-2", date: "2026-08-26", merchant: "Uber India", amount: 225, category: "Transport", kind: "debit" }
);
