

## Loan Management System -- Implementation Plan

### Overview
Add a complete Loan Management System with two database tables (`loans` and `loan_repayments`), a new "Loan Repayment" expense category, three new pages, and integration into the existing Dashboard and Reports.

---

### 1. Database Migration

**Table: `loans`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| loan_type | text NOT NULL | 'taken' or 'given' |
| lender_or_borrower_name | text NOT NULL | |
| principal_amount | numeric NOT NULL | |
| interest_rate | numeric | nullable, percentage |
| total_amount_due | numeric NOT NULL | auto-calculated on insert if interest exists |
| start_date | date NOT NULL | |
| end_date | date | nullable |
| repayment_frequency | text NOT NULL | 'monthly' or 'custom' |
| status | text NOT NULL | 'active' or 'closed', default 'active' |
| remaining_balance | numeric NOT NULL | starts equal to total_amount_due |
| created_by | uuid NOT NULL | references auth.users |
| created_at | timestamptz | default now() |

**Table: `loan_repayments`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| loan_id | uuid NOT NULL | FK to loans |
| payment_date | date NOT NULL | default CURRENT_DATE |
| amount_paid | numeric NOT NULL | |
| remaining_balance | numeric NOT NULL | snapshot after this payment |
| notes | text | nullable |
| created_by | uuid NOT NULL | |
| created_at | timestamptz | default now() |

**RLS Policies:**
- SELECT: all authenticated users (shared household)
- INSERT/UPDATE/DELETE on loans: admin only (via `has_role`)
- INSERT on repayments: admin only
- DELETE on repayments: admin only

**Additional migration steps:**
- Insert "Loan Repayment" into the `categories` table if it doesn't already exist.
- Create a database trigger on `loan_repayments` INSERT that:
  1. Decreases `loans.remaining_balance` by `amount_paid`
  2. Sets `loans.status = 'closed'` when remaining_balance reaches 0
  3. Auto-inserts a corresponding row into `expenses` (category = "Loan Repayment", user_id = created_by, amount = amount_paid, payment_method = "Bank", date = payment_date) so repayments appear in budgets and reports automatically.

---

### 2. New Data Hooks (`src/hooks/useLoanData.ts`)

- `useLoans(status?)` -- fetch all loans, optionally filtered by status
- `useLoanRepayments(loanId)` -- fetch repayments for a specific loan
- `useActiveLoanSummary()` -- computed totals: total debt, total receivable, monthly payment estimates

---

### 3. New Pages

**`src/pages/Loans.tsx`** -- Main loan list page
- Two tabs: "Loans Taken" and "Loans Given"
- Each tab shows a table with loan details, status badge (green/red), remaining balance
- "Add Loan" button (admin only) opens dialog form
- Overdue loans (end_date < today and status = active) highlighted in red
- Alert banner for loans with payments due within 5 days

**`src/pages/LoanDetail.tsx`** -- Individual loan detail (route: `/loans/:id`)
- Summary card: principal, interest, total due, remaining, status
- Progress bar showing repayment progress (paid / total_amount_due)
- Interest breakdown: principal vs interest portion
- Payment history table with all repayments
- "Record Payment" button (admin only) to add repayment
- Timeline visualization of payments

---

### 4. Dashboard Integration (`src/pages/Dashboard.tsx`)

Add four new summary cards:
- **Active Loans Taken** -- count of active loans where loan_type = 'taken'
- **Active Loans Given** -- count of active loans where loan_type = 'given'
- **Total Remaining Debt** -- sum of remaining_balance where loan_type = 'taken' and status = 'active'
- **Total Receivable** -- sum of remaining_balance where loan_type = 'given' and status = 'active'

Add a **Debt-to-Income Ratio** card:
- Formula: (Sum of this month's loan repayment expenses) / Monthly Income
- Displayed as percentage

Add alert banners:
- Red alert if any loan is overdue
- Yellow alert if any payment due within 5 days

---

### 5. Reports Integration (`src/pages/Reports.tsx`)

Add three new sections:
- **Total Debt Over Time** -- line chart showing remaining debt balance trend (derived from repayment history)
- **Total Repayments Made** -- summary card for the selected month
- **Net Liability vs Assets** -- bar chart comparing total loans taken vs total loans given (remaining balances)

---

### 6. Navigation Update (`src/components/AppSidebar.tsx`)

Add "Loans" nav item with a `Landmark` icon, pointing to `/loans`.

---

### 7. Routing Update (`src/App.tsx`)

Add two routes:
- `/loans` -> `Loans` page
- `/loans/:id` -> `LoanDetail` page

---

### Files Changed/Created

| File | Action |
|------|--------|
| Database migration (SQL) | Create `loans` and `loan_repayments` tables, RLS, trigger, category insert |
| `src/hooks/useLoanData.ts` | **New** -- loan query hooks |
| `src/pages/Loans.tsx` | **New** -- loan list page |
| `src/pages/LoanDetail.tsx` | **New** -- loan detail page |
| `src/components/AppSidebar.tsx` | Add Loans nav item |
| `src/App.tsx` | Add loan routes |
| `src/pages/Dashboard.tsx` | Add loan summary cards, debt-to-income ratio, alerts |
| `src/pages/Reports.tsx` | Add debt chart, repayments total, liability vs assets |
| `src/integrations/supabase/types.ts` | Auto-updated after migration |

### Technical Notes

- The database trigger handles the critical automation: updating remaining balance, closing loans, and creating expense records. This keeps the frontend simple and ensures data consistency even if the app is accessed from multiple devices.
- Loan repayments appearing as expenses means they automatically flow into budget usage, category breakdowns, and all existing charts without any additional frontend logic.
- All money values use ETB formatting via the existing `formatETB` helper.
- RLS ensures only admins can create/modify loans and repayments, while both household members can view everything.
