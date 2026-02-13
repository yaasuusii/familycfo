

## Personal Finance & Household Expense Management System

A professional, clean household financial control system for two users (Admin + Member) with ETB currency, built with Supabase Cloud backend.

---

### Phase 1: Authentication & User Management
- **Supabase Auth** with email/password login
- Admin (Husband) signs up first, then invites Wife via an invite flow
- Roles stored in a separate `user_roles` table (admin/member) — not on the profiles table
- `profiles` table with name, email, and created_at
- Shared household context — both users see the same financial data

### Phase 2: Database Schema
- **profiles** — linked to auth.users
- **user_roles** — admin/member roles with RLS security definer function
- **income** — date, source (Salary/Business/Other), amount, notes, user_id
- **expenses** — date, category, amount, payment_method (Cash/Bank/Telebirr), notes, user_id
- **budgets** — category, monthly_limit
- **categories** — customizable expense categories
- RLS policies so both household members can read/write all shared data, with "added by" tracking

### Phase 3: Layout & Navigation
- Clean, minimal light theme — white/light gray, subtle shadows, professional banking-app aesthetic
- Sidebar navigation: Dashboard, Income, Expenses, Grocery Tracker, Budgets, Reports, Settings
- Mobile-responsive with collapsible sidebar
- All amounts displayed in ETB

### Phase 4: Dashboard (Home Page)
- Summary cards: Total Monthly Income, Total Monthly Expenses, Remaining Balance, Grocery Spending, Savings Rate %
- Budget vs Actual comparison bar chart
- Expense breakdown by category (pie chart)
- Daily spending trend (line chart)
- End-of-month forecast projection card

### Phase 5: Income Module
- Add/edit/delete income entries with date, source, amount, notes
- Auto-records who added it
- Monthly and yearly summary tables

### Phase 6: Expense Module
- Add/edit/delete expenses with date, category, amount, payment method, notes
- Auto-records who added it
- Filters: date range, category, user
- Sortable table view

### Phase 7: Grocery Tracker
- Dedicated view filtering expenses to Grocery category
- Cards: monthly grocery total, average weekly cost, grocery % of total expenses
- Grocery spending trend line chart

### Phase 8: Budgeting System
- Set monthly income target and per-category budget limits
- Visual budget usage bars with percentage
- Warning indicators when a category exceeds its budget
- Remaining allowed spending per category

### Phase 9: Forecasting
- Based on current month's spending pace, estimate total monthly expense
- Estimated remaining balance at month end
- "Safe to spend" daily amount card

### Phase 10: Reports Page
- Monthly and yearly summary views
- Income vs Expense trend chart
- Category breakdown table
- Export to CSV functionality

### Phase 11: Settings
- Add/edit custom expense categories
- Manage household users (admin can invite/remove)
- Set/update monthly budgets
- Reset monthly view

