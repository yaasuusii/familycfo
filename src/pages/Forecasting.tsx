import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIncome, useExpenses, getCurrentMonth } from "@/hooks/useFinanceData";
import { useUpcomingRecurringForMonth } from "@/hooks/useRecurringData";
import { formatETB } from "@/lib/format";
import { Target, TrendingDown, TrendingUp, Wallet, CalendarDays, RefreshCw } from "lucide-react";

export default function Forecasting() {
  const month = getCurrentMonth();
  const { data: income = [] } = useIncome(month);
  const { data: expenses = [] } = useExpenses(month);
  const { upcomingExpenses, upcomingIncome } = useUpcomingRecurringForMonth();

  const totalIncome = useMemo(() => income.reduce((s, i) => s + Number(i.amount), 0), [income]);
  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses]);

  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - dayOfMonth;

  const dailyRate = dayOfMonth > 0 ? totalExpenses / dayOfMonth : 0;
  const projectedTotal = dailyRate * daysInMonth;
  const adjustedProjectedBalance = (totalIncome + upcomingIncome) - (projectedTotal + upcomingExpenses);
  const safeToSpend = daysRemaining > 0 ? Math.max(0, (totalIncome - totalExpenses) / daysRemaining) : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Forecasting</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ForecastCard title="Projected Monthly Expense" value={formatETB(projectedTotal)} subtitle={`Based on ${formatETB(dailyRate)}/day average`} icon={<TrendingDown className="h-5 w-5 text-destructive" />} />
        <ForecastCard title="Projected Balance" value={formatETB(adjustedProjectedBalance)} subtitle={adjustedProjectedBalance < 0 ? "⚠️ Projected deficit" : "Includes recurring transactions"} icon={<Wallet className="h-5 w-5 text-primary" />} danger={adjustedProjectedBalance < 0} />
        <ForecastCard title="Safe to Spend Daily" value={formatETB(safeToSpend)} subtitle={`${daysRemaining} days remaining`} icon={<Target className="h-5 w-5 text-success" />} />
        <ForecastCard title="Current Balance" value={formatETB(totalIncome - totalExpenses)} subtitle={`Day ${dayOfMonth} of ${daysInMonth}`} icon={<CalendarDays className="h-5 w-5 text-muted-foreground" />} />
      </div>

      {/* Recurring forecast cards */}
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
    <Card className={danger ? "border-destructive" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-muted-foreground">{title}</span></div>
        <p className={`text-2xl font-bold ${danger ? "text-destructive" : "text-foreground"}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
