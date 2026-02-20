

## Monthly Budget Control System Upgrade

### Current State
The budgets table has only `id`, `category`, `monthly_limit`, and `created_at` -- no `month` or `year` columns. Budgets are global, not tied to a specific month. The Dashboard has basic budget-vs-actual bars but no Budget Overview card, no Safe to Spend card, and no alert banners.

---

### 1. Database Migration

Add `month` (integer, 1-12) and `year` (integer) columns to the `budgets` table, with a unique constraint on `(category, month, year)` to enforce one budget per category per month. Existing rows will default to the current month/year.

Additionally, add an `income_target` column (numeric, nullable) so the admin can optionally set a monthly income target separate from actual income entries.

### 2. Updated Budgets Page (`src/pages/Budgets.tsx`)

**Month/Year selector** at the top so the admin can set budgets for any month.

**Budget form** updated to include `month` and `year` fields (auto-filled to selected month).

**Enhanced budget cards** for each category showing:
- Amount spent vs budget limit
- Remaining amount
- Usage percentage
- Color-coded status indicator:
  - Green (Safe) when under 80%
  - Yellow (Warning) when 80-100%
  - Red (Exceeded) when over 100%
- Progress bar colored to match status

**Alert banners** at the top:
- Red banner if any category exceeds its budget
- Yellow banner if overall budget usage exceeds 90%

**Income target field** -- admin can set a monthly income target.

**Edit capability** -- admin can update an existing budget's limit (not just delete and recreate).

### 3. Dashboard Enhancements (`src/pages/Dashboard.tsx`)

**New: Budget Overview Card** showing:
- Total budget allocated (sum of all category limits for current month)
- Total spent this month
- Remaining total budget
- Overall budget usage percentage with color indicator

**New: Category Budget Progress Bars** section -- visual bars for each budgeted category with limit, spent, and percentage.

**New: Safe to Spend Card** with formula:
`Safe to Spend = Total Income - Total Spent - Remaining Reserved Budget`
Where "Remaining Reserved Budget" = sum of (monthly_limit - actual_spent) for categories not yet exceeded.

**Alert banners** (same rules as Budgets page) -- red if any category exceeded, yellow if overall usage > 90%.

### 4. Hook Updates (`src/hooks/useFinanceData.ts`)

Update `useBudgets` to accept optional `month` and `year` parameters and filter accordingly. Default to current month/year.

### 5. Files Changed

| File | Change |
|------|--------|
| Database migration | Add `month`, `year`, `income_target` columns + unique constraint |
| `src/hooks/useFinanceData.ts` | Update `useBudgets` to filter by month/year |
| `src/pages/Budgets.tsx` | Full rewrite with month selector, status colors, alerts, edit, income target |
| `src/pages/Dashboard.tsx` | Add Budget Overview card, category bars, Safe to Spend card, alert banners |

### Technical Notes

- The unique constraint `(category, month, year)` prevents duplicate budgets per category per month at the database level.
- RLS policies remain unchanged -- admins can insert/update/delete, all authenticated users can view.
- Budget insert will include `month` and `year` fields from the selected period.
- All calculations use real expense data from the `expenses` table filtered to the same month.
- No mock data -- everything reads from the database.

