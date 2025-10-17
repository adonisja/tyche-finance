import { CreditCardAccount, PayoffPlanResult, PayoffStep, PayoffStrategyInput } from "@tyche/types";

type Strategy = "avalanche" | "snowball";

export interface StrategyOptions {
  strategy: Strategy;
}

export function simulatePayoff(input: PayoffStrategyInput, options: StrategyOptions): PayoffPlanResult {
  const cards = input.cards.map(c => ({ ...c }));
  const minPayments = new Map(cards.map(c => [c.id, c.minPayment]));
  const steps: PayoffStep[] = [];
  let month = 0;
  let totalInterest = 0;

  const sortFn = (a: CreditCardAccount, b: CreditCardAccount) => {
    if (options.strategy === "avalanche") return b.apr - a.apr; // highest APR first
    return a.balance - b.balance; // snowball: smallest balance first
  };

  while (cards.some(c => c.balance > 0.01) && month < 600) { // cap at 50 years
    // Order cards per strategy and skip paid off
    const order = cards.filter(c => c.balance > 0.01).sort(sortFn);

    // Accrue monthly interest
    const interestAccrued: Record<string, number> = {};
    for (const c of cards) {
      if (c.balance <= 0) { interestAccrued[c.id] = 0; continue; }
      const monthlyRate = c.apr / 12;
      const interest = c.balance * monthlyRate;
      c.balance += interest;
      totalInterest += interest;
      interestAccrued[c.id] = interest;
    }

    // Allocate payments
    let remaining = input.monthlyBudget + sumMap(minPayments);
    const allocations: Record<string, number> = {};

    // First, ensure minimums
    for (const c of cards) {
      const pay = Math.min(c.balance, minPayments.get(c.id) || 0);
      if (pay > 0) {
        c.balance -= pay;
        remaining -= pay;
        allocations[c.id] = (allocations[c.id] || 0) + pay;
      }
    }

    // Then, snowball or avalanche extra
    for (const c of order) {
      if (remaining <= 0) break;
      const pay = Math.min(c.balance, remaining);
      if (pay > 0) {
        c.balance -= pay;
        remaining -= pay;
        allocations[c.id] = (allocations[c.id] || 0) + pay;
      }
    }

    // Record balances
    const balances: Record<string, number> = {};
    for (const c of cards) balances[c.id] = round2(c.balance);

    steps.push({
      monthIndex: month,
      allocations,
      balances,
      interestAccrued,
    });

    month += 1;
  }

  return {
    totalInterest: round2(totalInterest),
    monthsToDebtFree: month,
    steps,
  };
}

function sumMap(map: Map<string, number>): number {
  let total = 0;
  for (const v of map.values()) total += v;
  return total;
}

function round2(n: number) { return Math.round(n * 100) / 100; }
