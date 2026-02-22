

## Recurring Transactions Engine

### Overview
Add two new database tables (`recurring_income` and `recurring_expenses`), a backend function to auto-generate entries on schedule, a management page, an upcoming payments dashboard widget, and forecast integration.

---

### 1. Database Migration

**Table: `recurring_income`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| title | text NOT NULL | e.g. "Salary", "Business profit" |
| amount | numeric NOT NULL | ETB |
| frequency | text NOT NULL | 'monthly', 'weekly', 'yearly' |
| start_date | date NOT NULL | |
| end_date | date | nullable |
| auto_post | boolean NOT NULL | default true |
| is_active | boolean NOT NULL | default true (for pause/resume) |
| last_generated_date | date | tracks last auto-generated date to prevent duplicates |
| created_by | uuid NOT NULL | references auth.users |
| created_at | timestamptz | default now() |

**Table: `recurring_expenses`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| title | text NOT NULL | e.g. "Rent", "Internet" |
| category | text NOT NULL | linked to categories |
| amount | numeric NOT NULL | ETB |
| frequency | text NOT NULL | 'monthly', 'weekly', 'yearly' |
| start_date | date NOT NULL | |
| end_date | date | nullable |
| auto_post | boolean NOT NULL | default true |
| is_active | boolean NOT NULL | default true |
| last_generated_date | date | |
| created_by | uuid NOT NULL | |
| created_at | timestamptz | default now() |

**RLS Policies (both tables):**
- SELECT: all authenticated users
- INSERT/UPDATE/DELETE: admin only (via `has_role`)

**Additional columns on existing tables:**
- Add `is_auto_generated` (boolean, default false) to both `income` and `expenses` tables so auto-generated entries can be identified and are editable after creation.
- Add `recurring_id` (uuid, nullable) to both `income` and `expenses` to link back to the recurring rule that created them.

---

### 2. Edge Function: `process-recurring`

A backend function that checks all active recurring rules and generates entries when due. Logic:

1. For each active recurring_income/recurring_expense where `auto_post = true`:
   - Calculate the next due date based on `frequency` and `last_generated_date` (or `start_date` if never generated)
   - If due date is today or in the past (and not past `end_date`), insert the corresponding `income` or `expenses` row with `is_auto_generated = true` and `recurring_id` set
   - Update `last_generated_date` on the recurring rule
   - If multiple periods were missed, generate entries for each missed period (catch-up)

2. This function will be invoked via a scheduled cron job (pg_cron) running daily.

---

### 3. New Page: `src/pages/RecurringTransactions.tsx`

**Two tabs:** "Recurring Income" and "Recurring Expenses"

Each tab shows a table with:
- Title, amount (ETB), frequency, next due date, status (Active/Paused)
- Actions (admin only): Edit, Pause/Resume, Delete
- "Add Recurring" button (admin only) opens a dialog form

**View History** button per item shows all generated entries from that recurring rule (filtered by `recurring_id`).

---

### 4. Dashboard: Upcoming Payments Widget

New card on the Dashboard showing transactions due in the next 7 days:
- Lists upcoming recurring expenses (and income) with title, amount, due date
- Overdue items (due date passed but not yet generated) highlighted in red
- Sorted by due date ascending

---

### 5. Forecast Integration (`src/pages/Forecasting.tsx`)

Update the forecasting calculations to include:
- Sum of upcoming recurring expenses for the remainder of the month
- Sum of upcoming recurring income for the remainder of the month
- New cards: "Upcoming Recurring Expenses" and "Upcoming Recurring Income"
- Adjust projected end-of-month balance to factor in known recurring transactions not yet posted

---

### 6. New Data Hook: `src/hooks/useRecurringData.ts`

- `useRecurringIncome()` -- fetch all recurring income rules
- `useRecurringExpenses()` -- fetch all recurring expense rules
- `useCreateRecurringIncome()` -- mutation
- `useCreateRecurringExpense()` -- mutation
- `useUpdateRecurring(table)` -- mutation for edit/pause
- `useDeleteRecurring(table)` -- mutation
- `useUpcomingRecurring()` -- computed: calculates next due dates for all active rules and returns items due within 7 days

---

### 7. Navigation and Routing

- Add "Recurring" nav item to sidebar with `RefreshCw` icon, pointing to `/recurring`
- Add route `/recurring` to `src/App.tsx`

---

### Files Changed/Created

| File | Action |
|------|--------|
| Database migration | Create `recurring_income` and `recurring_expenses` tables; add `is_auto_generated` and `recurring_id` to `income` and `expenses` |
| `supabase/functions/process-recurring/index.ts` | **New** -- edge function for auto-generating entries |
| `src/hooks/useRecurringData.ts` | **New** -- hooks for recurring CRUD and upcoming calculations |
| `src/pages/RecurringTransactions.tsx` | **New** -- management page |
| `src/pages/Dashboard.tsx` | Add Upcoming Payments widget |
| `src/pages/Forecasting.tsx` | Include recurring data in projections |
| `src/components/AppSidebar.tsx` | Add Recurring nav item |
| `src/App.tsx` | Add /recurring route |
| `src/integrations/supabase/types.ts` | Auto-updated after migration |

### Technical Notes

- The `last_generated_date` column prevents duplicate generation. The edge function compares this against the current date and frequency to determine if a new entry is needed.
- The `is_active` boolean enables pause/resume without deleting the rule.
- `is_auto_generated` on income/expenses marks entries as system-created but still allows manual editing.
- `recurring_id` links generated entries back to their source rule for history viewing.
- The cron job runs daily and catches up on any missed periods, so the system is resilient to downtime.
- The upcoming payments widget calculates due dates client-side from the recurring rules' frequency and last_generated_date, requiring no additional database queries beyond fetching the rules themselves.
