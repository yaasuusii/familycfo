// Centralized income/expense math so pages can't drift apart.
// "Real" totals exclude self-transfers and loan movements (loans tracked separately).

export const LOAN_INCOME_SOURCE = "Loan Taken";
export const LOAN_EXPENSE_CATEGORY = "Loan Repayment";

export type IncomeRow = {
  amount: number | null;
  source?: string | null;
  is_self_transfer?: boolean | null;
};

export type ExpenseRow = {
  amount: number | null;
  category?: string | null;
  is_self_transfer?: boolean | null;
};

export function sum<T extends { amount: number | null }>(rows: T[]): number {
  return rows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
}

export function isIncomeLoan(r: IncomeRow): boolean {
  return r.source === LOAN_INCOME_SOURCE;
}

export function isExpenseLoan(r: ExpenseRow): boolean {
  return r.category === LOAN_EXPENSE_CATEGORY;
}

export function isTransfer(r: { is_self_transfer?: boolean | null }): boolean {
  return Boolean(r.is_self_transfer);
}

/** Income excluding self-transfers and loans taken. */
export function realIncome(rows: IncomeRow[]): IncomeRow[] {
  return rows.filter((r) => !isTransfer(r) && !isIncomeLoan(r));
}

/** Expenses excluding self-transfers and loan repayments. */
export function realExpenses(rows: ExpenseRow[]): ExpenseRow[] {
  return rows.filter((r) => !isTransfer(r) && !isExpenseLoan(r));
}

export type IncomeBreakdown = {
  real: number;      // spendable income
  loans: number;     // money borrowed
  transfers: number; // self-transfers
  all: number;       // raw total
};

export function incomeBreakdown(rows: IncomeRow[]): IncomeBreakdown {
  let real = 0, loans = 0, transfers = 0, all = 0;
  for (const r of rows) {
    const amt = Number(r.amount) || 0;
    all += amt;
    if (isTransfer(r)) transfers += amt;
    else if (isIncomeLoan(r)) loans += amt;
    else real += amt;
  }
  return { real, loans, transfers, all };
}

export type ExpenseBreakdown = {
  real: number;      // actual spending
  loans: number;     // loan repayments
  transfers: number; // self-transfers
  all: number;       // raw total
};

export function expenseBreakdown(rows: ExpenseRow[]): ExpenseBreakdown {
  let real = 0, loans = 0, transfers = 0, all = 0;
  for (const r of rows) {
    const amt = Number(r.amount) || 0;
    all += amt;
    if (isTransfer(r)) transfers += amt;
    else if (isExpenseLoan(r)) loans += amt;
    else real += amt;
  }
  return { real, loans, transfers, all };
}
