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

/** Income excluding self-transfers, loans taken, and reimbursement paybacks. */
export function realIncome(rows: IncomeRow[]): IncomeRow[] {
  return rows.filter((r) => !isTransfer(r) && !isIncomeLoan(r) && !isIncomeReimbursement(r));
}

/** Expenses excluding self-transfers, loan repayments, and reimbursed (paid-back) spend. */
export function realExpenses<T extends ExpenseRow>(rows: T[]): T[] {
  return rows.filter((r) => !isTransfer(r) && !isExpenseLoan(r) && !isReimbursed(r));
}


export type IncomeBreakdown = {
  real: number;          // spendable income
  loans: number;         // money borrowed
  reimbursements: number; // work paybacks (cash returned)
  transfers: number;     // self-transfers
  all: number;           // raw total
};

export function incomeBreakdown(rows: IncomeRow[]): IncomeBreakdown {
  let real = 0, loans = 0, reimbursements = 0, transfers = 0, all = 0;
  for (const r of rows) {
    const amt = Number(r.amount) || 0;
    all += amt;
    if (isTransfer(r)) transfers += amt;
    else if (isIncomeLoan(r)) loans += amt;
    else if (isIncomeReimbursement(r)) reimbursements += amt;
    else real += amt;
  }
  return { real, loans, reimbursements, transfers, all };
}

export type ExpenseBreakdown = {
  real: number;               // actual spending (incl. pending reimbursables — still out of pocket)
  loans: number;              // loan repayments
  reimbursed: number;         // paid-back spend (netted out)
  pendingReimbursable: number; // reimbursable awaiting payback (subset of real)
  transfers: number;          // self-transfers
  all: number;                // raw total
};

export function expenseBreakdown(rows: ExpenseRow[]): ExpenseBreakdown {
  let real = 0, loans = 0, reimbursed = 0, pendingReimbursable = 0, transfers = 0, all = 0;
  for (const r of rows) {
    const amt = Number(r.amount) || 0;
    all += amt;
    if (isTransfer(r)) transfers += amt;
    else if (isExpenseLoan(r)) loans += amt;
    else if (isReimbursed(r)) reimbursed += amt;
    else {
      real += amt;
      if (isPendingReimbursable(r)) pendingReimbursable += amt;
    }
  }
  return { real, loans, reimbursed, pendingReimbursable, transfers, all };
}
