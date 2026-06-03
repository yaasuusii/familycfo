// Centralized income/expense math so pages can't drift apart.
// "Real" totals exclude self-transfers and loan movements (loans tracked separately).

export const LOAN_INCOME_SOURCE = "Loan Taken";
export const LOAN_EXPENSE_CATEGORY = "Loan Repayment";
export const REIMBURSEMENT_INCOME_SOURCE = "Reimbursement";

export type IncomeRow = {
  amount: number | null;
  source?: string | null;
  is_self_transfer?: boolean | null;
};

export type ExpenseRow = {
  amount: number | null;
  category?: string | null;
  is_self_transfer?: boolean | null;
  is_reimbursable?: boolean | null;
  reimbursement_status?: string | null;
};

export function sum<T extends { amount: number | null }>(rows: T[]): number {
  return rows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
}

export function isIncomeLoan(r: IncomeRow): boolean {
  return r.source === LOAN_INCOME_SOURCE;
}

export function isIncomeReimbursement(r: IncomeRow): boolean {
  return r.source === REIMBURSEMENT_INCOME_SOURCE;
}

export function isExpenseLoan(r: ExpenseRow): boolean {
  return r.category === LOAN_EXPENSE_CATEGORY;
}

/** Reimbursable expense that has been paid back — nets to zero. */
export function isReimbursed(r: ExpenseRow): boolean {
  return Boolean(r.is_reimbursable) && r.reimbursement_status === "received";
}

/** Reimbursable expense still awaiting payback — out of pocket right now. */
export function isPendingReimbursable(r: ExpenseRow): boolean {
  return Boolean(r.is_reimbursable) && r.reimbursement_status !== "received";
}

export function isTransfer(r: { is_self_transfer?: boolean | null }): boolean {
  return Boolean(r.is_self_transfer);
}

/**
 * Income excluding self-transfers and loans taken.
 * Reimbursement paybacks DO count as real income — they offset the matching
 * spend, and any per-diem/partial difference nets out automatically.
 */
export function realIncome(rows: IncomeRow[]): IncomeRow[] {
  return rows.filter((r) => !isTransfer(r) && !isIncomeLoan(r));
}

/**
 * Expenses excluding self-transfers and loan repayments.
 * Reimbursable spend ALWAYS counts as real money out (cash left the account).
 * The matching Reimbursement income cancels it; if the lump payback differs
 * from the sum, the net difference is correctly reflected.
 */
export function realExpenses<T extends ExpenseRow>(rows: T[]): T[] {
  return rows.filter((r) => !isTransfer(r) && !isExpenseLoan(r));
}


export type IncomeBreakdown = {
  real: number;          // spendable income (INCLUDES reimbursements)
  loans: number;         // money borrowed
  reimbursements: number; // work paybacks (subset of real)
  transfers: number;     // self-transfers
  all: number;           // raw total
};

export function incomeBreakdown(rows: IncomeRow[]): IncomeBreakdown {
  let real = 0, loans = 0, reimbursements = 0, transfers = 0, all = 0;
  for (const r of rows) {
    const amt = Number(r.amount) || 0;
    all += amt;
    if (isTransfer(r)) { transfers += amt; continue; }
    if (isIncomeLoan(r)) { loans += amt; continue; }
    // everything else is real income; reimbursements are a tracked subset
    real += amt;
    if (isIncomeReimbursement(r)) reimbursements += amt;
  }
  return { real, loans, reimbursements, transfers, all };
}

export type ExpenseBreakdown = {
  real: number;               // actual spending — ALL reimbursable spend included (cash left account)
  loans: number;              // loan repayments
  reimbursed: number;         // paid-back spend (subset of real; offset by Reimbursement income)
  pendingReimbursable: number; // reimbursable awaiting payback (subset of real)
  transfers: number;          // self-transfers
  all: number;                // raw total
};

export function expenseBreakdown(rows: ExpenseRow[]): ExpenseBreakdown {
  let real = 0, loans = 0, reimbursed = 0, pendingReimbursable = 0, transfers = 0, all = 0;
  for (const r of rows) {
    const amt = Number(r.amount) || 0;
    all += amt;
    if (isTransfer(r)) { transfers += amt; continue; }
    if (isExpenseLoan(r)) { loans += amt; continue; }
    // everything else is real spend; reimbursable rows are tracked subsets
    real += amt;
    if (isReimbursed(r)) reimbursed += amt;
    else if (isPendingReimbursable(r)) pendingReimbursable += amt;
  }
  return { real, loans, reimbursed, pendingReimbursable, transfers, all };
}
