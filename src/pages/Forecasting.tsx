import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIncome, useExpenses } from "@/hooks/useFinanceData";
import { useUpcomingRecurringForMonth } from "@/hooks/useRecurringData";
import { getFinancialPeriod } from "@/lib/finance-period";
import { incomeBreakdown, expenseBreakdown } from "@/lib/finance-calc";
import { formatETB } from "@/lib/format";
import { Target, TrendingDown, TrendingUp, Wallet, CalendarDays, RefreshCw } from "lucide-react";

export default function Forecasting() {
  const period = useMemo(() => getFinancialPeriod(), []);
  const { data: income = [] } = useIncome(period);
  const { data: expenses = [] } = useExpenses(period);
  const { upcomingExpenses, upcomingIncome } = useUpcomingRecurringForMonth();

  // Real totals exclude self-transfers and loan movements.
  const totalIncome = useMemo(() => incomeBreakdown(income).real, [income]);
  const totalExpenses = useMemo(() => expenseBreakdown(expenses).real, [expenses]);

  // Day math over the pay-cycle window.
  const MS_DAY = 86400000;
  const start = new Date(period.start + "T00:00:00");
  const end = new Date(period.end + "T00:00:00");
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
  const daysInMonth = Math.round((end.getTime() - start.getTime()) / MS_DAY) + 1;
  const dayOfMonth = Math.min(Math.max(Math.floor((today.getTime() - start.getTime()) / MS_DAY) + 1, 1), daysInMonth);
  const daysRemaining = daysInMonth - dayOfMonth;

  const dailyRate = dayOfMonth > 0 ? totalExpenses / dayOfMonth : 0;
  const projectedTotal = dailyRate * daysInMonth;
  const adjustedProjectedBalance = (totalIncome + upcomingIncome) - (projectedTotal + upcomingExpenses);
  const safeToSpend = daysRemaining > 0 ? Math.max(0, (totalIncome - totalExpenses) / daysRemaining) : 0;

  const ethMonthLabel = period.label;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Family CFO</p>
        <h2 className="font-display text-3xl font-semibold tracking-tight">Forecasting</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{ethMonthLabel}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <ForecastCard title="Projected Monthly Expense" value={formatETB(projectedTotal)} subtitle={`Based on ${formatETB(dailyRate)}/day average`} icon={<TrendingDown className="h-5 w-5 text-destructive" />} />
        <ForecastCard title="Projected Balance" value={formatETB(adjustedProjectedBalance)} subtitle={adjustedProjectedBalance < 0 ? "⚠️ Projected deficit" : "Includes recurring transactions"} icon={<Wallet className="h-5 w-5 text-primary" />} danger={adjustedProjectedBalance < 0} />
        <ForecastCard title="Safe to Spend Daily" value={formatETB(safeToSpend)} subtitle={`${daysRemaining} days remaining`} icon={<Target className="h-5 w-5 text-success" />} />
        <ForecastCard title="Current Balance" value={formatETB(totalIncome - totalExpenses)} subtitle={`Day ${dayOfMonth} of ${daysInMonth}`} icon={<CalendarDays className="h-5 w-5 text-muted-foreground" />} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ForecastCard title="Upcoming Recurring Income" value={formatETB(upcomingIncome)} subtitle="Remaining this month" icon={<TrendingUp className="h-5 w-5 text-success" />} />
        <ForecastCard title="Upcoming Recurring Expenses" value={formatETB(upcomingExpenses)} subtitle="Remaining this month" icon={<RefreshCw className="h-5 w-5 text-destructive" />} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Spending Pace</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Month progress</span>
              <span className="font-medium">{((dayOfMonth / daysInMonth) * 100).toFixed(0)}%</span>
            </div>
            <div className="h-3 rounded-full bg-secondary">
              <div className="h-3 rounded-full bg-primary transition-all" style={{ width: `${(dayOfMonth / daysInMonth) * 100}%` }} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Budget consumed</span>
              <span className="font-medium">{totalIncome > 0 ? ((totalExpenses / totalIncome) * 100).toFixed(0) : 0}%</span>
            </div>
            <div className="h-3 rounded-full bg-secondary">
              <div className={`h-3 rounded-full transition-all ${totalExpenses > totalIncome ? "bg-destructive" : "bg-success"}`} style={{ width: `${Math.min((totalExpenses / Math.max(totalIncome, 1)) * 100, 100)}%` }} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ForecastCard({ title, value, subtitle, icon, danger }: { title: string; value: string; subtitle: string; icon: React.ReactNode; danger?: boolean }) {
  return (
    <div className={`card-soft lift p-4 ${danger ? "border-destructive/50" : ""}`}>
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">{icon}</div>
        <span className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</span>
      </div>
      <p className={`font-display text-xl font-semibold tracking-tight tnum sm:text-2xl ${danger ? "text-destructive" : "text-foreground"}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}
