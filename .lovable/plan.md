
## Fix: All Data Queries Failing Due to Invalid Date Range

### Root Cause
The `useIncome` and `useExpenses` hooks in `src/hooks/useFinanceData.ts` construct a date range using a hardcoded `-31` suffix for the end of the month (e.g., `2026-02-31`). February only has 28 days, so the database rejects every query with: `"date/time field value out of range"`.

Data inserts work fine (they return 201), but the SELECT queries all fail, which is why forms show "success" but no data ever appears in tables, charts, or dashboard cards.

### The Fix
Update `src/hooks/useFinanceData.ts` to calculate the correct last day of each month dynamically. Instead of:
```
const end = `${month}-31`;
```
Use JavaScript's `new Date(year, month, 0).getDate()` trick to get the actual last day (28, 29, 30, or 31).

### What This Fixes (All Pages)
- **Dashboard** -- Summary cards, pie chart, line chart, budget comparison, forecast card
- **Income** -- Monthly total and table listing
- **Expenses** -- Filtered table and total
- **Grocery Tracker** -- Monthly total, weekly average, percentage, trend chart
- **Forecasting** -- All projection calculations
- **Reports** -- Monthly summaries, category breakdown, CSV export
- **Budgets** -- Budget vs actual comparison (depends on expenses query)

### Technical Detail
Only one file needs to change: `src/hooks/useFinanceData.ts`. A helper function will parse the `YYYY-MM` month string, compute the real last day, and use that in both `useIncome` and `useExpenses`.

No database changes are needed. No other files need modification.
