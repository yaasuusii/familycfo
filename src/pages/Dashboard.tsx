import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useIncome, useExpenses, useBudgets, getCurrentMonth } from "@/hooks/useFinanceData";
import { useLoans } from "@/hooks/useLoanData";
import { useUpcomingRecurring } from "@/hooks/useRecurringData";
import { formatETB, formatPercent } from "@/lib/format";
import { getCurrentEthiopianMonth, getEthiopianMonthName, getEthiopianDaysInMonth, toEthiopian } from "@/lib/ethiopian-calendar";
import { TrendingUp, TrendingDown, Wallet, ShoppingCart, PiggyBank, Target, ShieldAlert, AlertTriangle, Landmark, HandCoins, Scale, RefreshCw } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, Legend } from "recharts";

const COLORS = ["hsl(220,70%,50%)", "hsl(142,71%,45%)", "hsl(38,92%,50%)", "hsl(280,65%,60%)", "hsl(0,72%,51%)", "hsl(190,80%,45%)", "hsl(330,65%,55%)"];

function getStatusColor(pct: number) {
  if (pct >= 100) return "text-destructive";
  if (pct >= 80) return "text-warning";
  return "text-success";
}

function getStatusBg(pct: number) {
  if (pct >= 100) return "bg-destructive";
  if (pct >= 80) return "bg-warning";
  return "bg-success";
}

export default function Dashboard() {
  const month = getCurrentMonth();
  const eth = getCurrentEthiopianMonth();

  const { data: income = [] } = useIncome(month);
  const { data: expenses = [] } = useExpenses(month);
  const { data: budgets = [] } = useBudgets(eth.month, eth.year);
  const { data: allLoans = [] } = useLoans();
  const upcomingItems = useUpcomingRecurring();

  const activeLoans = useMemo(() => allLoans.filter((l) => l.status === "active"), [allLoans]);
  const activeTaken = useMemo(() => activeLoans.filter((l) => l.loan_type === "taken"), [activeLoans]);
  const activeGiven = useMemo(() => activeLoans.filter((l) => l.loan_type === "given"), [activeLoans]);
  const totalDebt = activeTaken.reduce((s, l) => s + Number(l.remaining_balance), 0);
  const totalReceivable = activeGiven.reduce((s, l) => s + Number(l.remaining_balance), 0);

  const now = new Date();
  const hasOverdueLoan = activeLoans.some((l) => l.end_date && new Date(l.end_date) < now);
  const hasDueSoonLoan = activeLoans.some((l) => {
    if (!l.end_date) return false;
    const diff = (new Date(l.end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff <= 5;
  });

  const totalIncome = useMemo(() => income.reduce((s, i) => s + Number(i.amount), 0), [income]);
  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses]);
  const remaining = totalIncome - totalExpenses;
  const grocerySpend = useMemo(() => expenses.filter((e) => e.category === "Grocery").reduce((s, e) => s + Number(e.amount), 0), [expenses]);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  const loanRepaymentThisMonth = useMemo(() => expenses.filter((e) => e.category === "Loan Repayment").reduce((s, e) => s + Number(e.amount), 0), [expenses]);
  const debtToIncomeRatio = totalIncome > 0 ? (loanRepaymentThisMonth / totalIncome) * 100 : 0;

  const budgetStats = useMemo(() => {
    return budgets.map((b) => {
      const actual = expenses.filter((e) => e.category === b.category).reduce((s, e) => s + Number(e.amount), 0);
      const limit = Number(b.monthly_limit);
      const pct = limit > 0 ? (actual / limit) * 100 : 0;
      const remainingBudget = limit - actual;
      return { category: b.category, limit, actual, pct, remaining: remainingBudget };
    });
  }, [budgets, expenses]);

  const totalBudget = budgetStats.reduce((s, b) => s + b.limit, 0);
  const totalBudgetSpent = budgetStats.reduce((s, b) => s + b.actual, 0);
  const overallBudgetPct = totalBudget > 0 ? (totalBudgetSpent / totalBudget) * 100 : 0;
  const anyExceeded = budgetStats.some((b) => b.pct >= 100);
  const overallWarning = overallBudgetPct > 90;

  const remainingReserved = budgetStats
    .filter((b) => b.pct < 100)
    .reduce((s, b) => s + Math.max(b.remaining, 0), 0);
  const safeToSpend = totalIncome - totalExpenses - remainingReserved;

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => { map[e.category] = (map[e.category] || 0) + Number(e.amount); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const dailyTrend = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => { map[e.date] = (map[e.date] || 0) + Number(e.amount); });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date: date.slice(5), amount }));
  }, [expenses]);

  const dayOfMonth = eth.day;
  const daysInMonth = getEthiopianDaysInMonth(eth.month, eth.year);
  const projectedExpenses = dayOfMonth > 0 ? (totalExpenses / dayOfMonth) * daysInMonth : 0;
  const projectedRemaining = totalIncome - projectedExpenses;

  const ethMonthLabel = `${getEthiopianMonthName(eth.month)} ${eth.year}`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground">{ethMonthLabel} · Day {dayOfMonth} of {daysInMonth}</p>
      </div>

      {/* Alert Banners */}
      {anyExceeded && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>One or more budget categories have been exceeded!</AlertDescription>
        </Alert>
      )}
      {!anyExceeded && overallWarning && (
        <Alert className="border-warning/50 text-warning [&>svg]:text-warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Overall budget usage is above 90% ({formatPercent(overallBudgetPct)})</AlertDescription>
        </Alert>
      )}
      {hasOverdueLoan && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>One or more loans are overdue!</AlertDescription>
        </Alert>
      )}
      {!hasOverdueLoan && hasDueSoonLoan && (
        <Alert className="border-warning/50 text-warning [&>svg]:text-warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Loan payments due within 5 days.</AlertDescription>
        </Alert>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryCard title="Monthly Income" value={formatETB(totalIncome)} icon={<TrendingUp className="h-4 w-4 text-success" />} />
        <SummaryCard title="Monthly Expenses" value={formatETB(totalExpenses)} icon={<TrendingDown className="h-4 w-4 text-destructive" />} />
        <SummaryCard title="Remaining" value={formatETB(remaining)} icon={<Wallet className="h-4 w-4 text-primary" />} />
        <SummaryCard title="Grocery" value={formatETB(grocerySpend)} icon={<ShoppingCart className="h-4 w-4 text-warning" />} />
        <SummaryCard title="Savings Rate" value={formatPercent(savingsRate)} icon={<PiggyBank className="h-4 w-4 text-success" />} />
        <SummaryCard title="Projected Balance" value={formatETB(projectedRemaining)} icon={<Target className="h-4 w-4 text-primary" />} />
      </div>

      {/* Loan Summary Cards */}
      {allLoans.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard title="Active Loans Taken" value={String(activeTaken.length)} icon={<Landmark className="h-4 w-4 text-destructive" />} />
          <SummaryCard title="Active Loans Given" value={String(activeGiven.length)} icon={<HandCoins className="h-4 w-4 text-success" />} />
          <SummaryCard title="Total Debt" value={formatETB(totalDebt)} icon={<TrendingDown className="h-4 w-4 text-destructive" />} />
          <SummaryCard title="Total Receivable" value={formatETB(totalReceivable)} icon={<TrendingUp className="h-4 w-4 text-success" />} />
          <SummaryCard title="Debt-to-Income" value={formatPercent(debtToIncomeRatio)} icon={<Scale className="h-4 w-4 text-warning" />} />
        </div>
      )}

      {/* Budget Overview + Safe to Spend */}
      {budgetStats.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Budget Overview</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Allocated</span>
                <span className="font-medium text-foreground">{formatETB(totalBudget)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Spent</span>
                <span className="font-medium text-foreground">{formatETB(totalBudgetSpent)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Remaining</span>
                <span className="font-medium text-foreground">{formatETB(totalBudget - totalBudgetSpent)}</span>
              </div>
              <Progress value={Math.min(overallBudgetPct, 100)} className="h-2.5" />
              <p className={`text-sm font-medium ${getStatusColor(overallBudgetPct)}`}>
                {formatPercent(overallBudgetPct)} used
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Safe to Spend</CardTitle></CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-4">
              <p className={`text-3xl font-bold ${safeToSpend >= 0 ? "text-success" : "text-destructive"}`}>
                {formatETB(safeToSpend)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Income − Spent − Reserved Budget</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Category Budget Progress Bars */}
      {budgetStats.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Category Budgets</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {budgetStats.map((b) => (
              <div key={b.category} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-foreground">{b.category}</span>
                  <span className={`font-medium ${getStatusColor(b.pct)}`}>
                    {formatETB(b.actual)} / {formatETB(b.limit)} ({formatPercent(b.pct)})
                  </span>
                </div>
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full transition-all ${getStatusBg(b.pct)}`}
                    style={{ width: `${Math.min(b.pct, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Recurring Payments */}
      {upcomingItems.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><RefreshCw className="h-4 w-4" />Upcoming in Next 7 Days</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {upcomingItems.map((item) => (
              <div key={item.id + item.dueDate.toISOString()} className={`flex justify-between items-center text-sm py-1 border-b last:border-0 ${item.isOverdue ? "text-destructive" : ""}`}>
                <div>
                  <span className="font-medium">{item.title}</span>
                  {item.category && <span className="text-muted-foreground ml-2 text-xs">({item.category})</span>}
                  {item.isOverdue && <span className="ml-2 text-xs font-semibold">OVERDUE</span>}
                </div>
                <div className="text-right">
                  <span className="font-medium">{formatETB(item.amount)}</span>
                  <span className="text-muted-foreground ml-2 text-xs">{item.dueDate.toISOString().slice(0, 10)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Expense Breakdown</CardTitle></CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatETB(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-sm text-muted-foreground py-8">No expenses yet</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Daily Spending Trend</CardTitle></CardHeader>
          <CardContent>
            {dailyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={dailyTrend}>
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => formatETB(v)} />
                  <Line type="monotone" dataKey="amount" stroke="hsl(220,70%,50%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-sm text-muted-foreground py-8">No data yet</p>}
          </CardContent>
        </Card>
      </div>

      {/* Budget comparison bar chart */}
      {budgetStats.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Budget vs Actual</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={budgetStats}>
                <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatETB(v)} />
                <Legend />
                <Bar dataKey="limit" fill="hsl(220,70%,50%)" name="Budget" />
                <Bar dataKey="actual" fill="hsl(38,92%,50%)" name="Actual" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-lg font-semibold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
