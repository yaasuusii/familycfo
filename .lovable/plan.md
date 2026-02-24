

## Ethiopian Calendar Integration

### Overview
Add full Ethiopian calendar support throughout the app: display dates in Ethiopian format (e.g., "16 Yekatit 2018") and shift financial month boundaries so each month runs from the 7th of one Gregorian month to the 6th of the next, aligning with Ethiopian calendar months.

---

### 1. New Utility: `src/lib/ethiopian-calendar.ts`

Create a pure-TypeScript Ethiopian calendar conversion library with:

- **`toEthiopian(gregorianDate: Date)`** -- converts a Gregorian date to `{ year, month, day }` in the Ethiopian calendar using the standard JDN (Julian Day Number) algorithm
- **`toGregorian(ethYear, ethMonth, ethDay)`** -- converts back
- **`formatEthiopianDate(date: Date)`** -- returns string like "16 Yekatit 2018"
- **`getEthiopianMonthName(month: number)`** -- returns month name (Meskerem, Tikimt, Hidar, Tahsas, Tir, Yekatit, Megabit, Miyazia, Ginbot, Sene, Hamle, Nehase, Pagume)
- **`getCurrentEthiopianMonth()`** -- returns the current Ethiopian month/year
- **`getEthiopianMonthDateRange(ethYear, ethMonth)`** -- returns the Gregorian start and end dates for querying the database

No external dependencies needed -- the conversion algorithm is straightforward math.

---

### 2. Update `src/hooks/useFinanceData.ts`

- **`getCurrentMonth()`** -- change to return an Ethiopian month identifier instead of `"YYYY-MM"`, or keep a compatible format that maps to Gregorian date ranges using the 7th boundary
- **`useIncome(month)` and `useExpenses(month)`** -- update the date range filtering to use Ethiopian month boundaries (e.g., Feb 7 to Mar 6 instead of Feb 1 to Feb 28)
- **`useBudgets()`** -- update month/year to use Ethiopian month numbers

---

### 3. Update Date Display Across All Pages

**Files affected:**
- `src/pages/Expenses.tsx` -- show Ethiopian date in table cells (e.g., "16 Yekatit 2018") alongside or instead of Gregorian
- `src/pages/Income.tsx` -- same
- `src/pages/Dashboard.tsx` -- update "Day X of Y" to reflect Ethiopian month progress; dates in upcoming widget
- `src/pages/Reports.tsx` -- month selector shows Ethiopian month names; date displays in tables
- `src/pages/Budgets.tsx` -- month selector shows Ethiopian month names (Meskerem through Pagume)
- `src/pages/Forecasting.tsx` -- update day-of-month and days-remaining calculations to use Ethiopian month boundaries
- `src/pages/GroceryTracker.tsx` -- date labels in charts
- `src/pages/RecurringTransactions.tsx` -- next due date display

---

### 4. Update Month Selectors

Replace Gregorian month names (Jan, Feb, ...) with Ethiopian month names (Meskerem, Tikimt, ...) in:
- Budgets page month picker
- Reports page month picker

Year selector will show Ethiopian years (e.g., 2018 instead of 2026).

---

### 5. Update Forecasting Calculations

In `src/pages/Forecasting.tsx`:
- `dayOfMonth` and `daysInMonth` recalculated based on Ethiopian month (30 days for months 1-12, 5-6 for Pagume)
- Daily spending rate and projections use the shifted boundaries
- "Month progress" bar reflects Ethiopian month progress

---

### 6. Update Recurring Data Hook

In `src/hooks/useRecurringData.ts`:
- `useUpcomingRecurringForMonth()` -- use Ethiopian month end date instead of Gregorian month end

---

### 7. Date Input Handling

Date inputs (`<input type="date">`) will remain Gregorian (browser native), but:
- Display a helper text showing the Ethiopian equivalent below date inputs
- Store dates in the database as Gregorian (no schema changes needed)
- Convert to Ethiopian only for display purposes

---

### Technical Details

**Ethiopian Calendar Conversion Algorithm:**

The conversion uses the Julian Day Number as an intermediary:
1. Gregorian date -> JDN -> Ethiopian date
2. Ethiopian calendar has 13 months: 12 months of 30 days + Pagume (5 or 6 days)
3. Ethiopian New Year (Meskerem 1) falls on September 11 (or 12 in leap years)
4. Current Gregorian date Feb 23, 2026 = approximately Yekatit 16, 2018 in Ethiopian calendar

**Month Boundary Mapping (approximate):**

| Ethiopian Month | Gregorian Range |
|----------------|-----------------|
| Meskerem | Sep 11 - Oct 10 |
| Tikimt | Oct 11 - Nov 9 |
| Hidar | Nov 10 - Dec 9 |
| Tahsas | Dec 10 - Jan 8 |
| Tir | Jan 9 - Feb 7 |
| Yekatit | Feb 8 - Mar 9 |
| Megabit | Mar 10 - Apr 8 |
| Miyazia | Apr 9 - May 8 |
| Ginbot | May 9 - Jun 7 |
| Sene | Jun 8 - Jul 7 |
| Hamle | Jul 8 - Aug 6 |
| Nehase | Aug 7 - Sep 5 |
| Pagume | Sep 6 - Sep 10 |

**No database changes needed** -- dates remain stored as Gregorian. All conversion happens at the display and query layer.

---

### Files Changed/Created

| File | Action |
|------|--------|
| `src/lib/ethiopian-calendar.ts` | **New** -- conversion utilities |
| `src/hooks/useFinanceData.ts` | Update month boundaries and getCurrentMonth |
| `src/hooks/useRecurringData.ts` | Update month-end calculations |
| `src/pages/Dashboard.tsx` | Ethiopian date display |
| `src/pages/Expenses.tsx` | Ethiopian date in table |
| `src/pages/Income.tsx` | Ethiopian date in table |
| `src/pages/Reports.tsx` | Ethiopian month selector |
| `src/pages/Budgets.tsx` | Ethiopian month selector |
| `src/pages/Forecasting.tsx` | Ethiopian month calculations |
| `src/pages/GroceryTracker.tsx` | Ethiopian dates in chart |
| `src/pages/RecurringTransactions.tsx` | Ethiopian date display |
| `src/lib/format.ts` | Add date formatting helper |

