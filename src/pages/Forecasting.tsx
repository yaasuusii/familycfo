import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useIncome, useExpenses } from "@/hooks/useFinanceData";
import { useUpcomingRecurringForMonth } from "@/hooks/useRecurringData";
import { useFinancialInsights } from "@/hooks/useFinancialInsights";
import { getFinancialPeriod } from "@/lib/finance-period";
import { incomeBreakdown, expenseBreakdown } from "@/lib/finance-calc";
import { formatETB } from "@/lib/format";
import {
  Target, TrendingDown, TrendingUp, Wallet, CalendarDays, RefreshCw,
  Sparkles, Lightbulb, AlertTriangle, Loader2,
} from "lucide-react";

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

  const ai = useFinancialInsights();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Family CFO</p>
        <h2 className="font-display text-3xl font-semibold tracking-tight">Forecasting</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{ethMonthLabel}</p>
      </div>

      <AiInsightCard ai={ai} />

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

const OUTLOOK: Record<string, { label: string; cls: string }> = {
  good: { label: "On track", cls: "bg-success/15 text-success border-success/30" },
  watch: { label: "Watch", cls: "bg-warning/15 text-warning border-warning/30" },
  tight: { label: "Tight", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

function AiInsightCard({ ai }: { ai: ReturnType<typeof useFinancialInsights> }) {
  const insight = ai.insight;
  const data = insight?.ai;
  const generatedAt = insight?.generatedAt;
  const outlook = data ? OUTLOOK[data.outlook] ?? OUTLOOK.watch : null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">CFO Insight</CardTitle>
            <p className="text-xs text-muted-foreground">
              {generatedAt
                ? `Updated ${new Date(generatedAt).toLocaleDateString()} · Gemini`
                : "AI read of this month"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {outlook && <Badge variant="outline" className={outlook.cls}>{outlook.label}</Badge>}
          {ai.canRefresh && (
            <Button variant="outline" size="sm" onClick={ai.refresh} disabled={ai.generating}>
              {ai.generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-1 hidden sm:inline">Refresh</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {ai.loading && !data ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading your numbers…
          </div>
        ) : ai.error && !data ? (
          <div className="py-2">
            <p className="text-sm text-muted-foreground">
              Couldn't generate insight. {ai.canRefresh && "Try Refresh."}
            </p>
            <p className="mt-1 break-words text-xs text-destructive/80">{ai.error.message}</p>
          </div>
        ) : !data ? (
          <p className="py-2 text-sm text-muted-foreground">
            No insight yet. {ai.canRefresh ? "Tap Refresh to generate." : "Ask an admin to generate one."}
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium leading-relaxed text-foreground">{data.summary}</p>

            {data.insights?.length > 0 && (
              <ul className="space-y-1.5">
                {data.insights.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            )}

            {data.risks?.length > 0 && (
              <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" /> Watch out
                </p>
                <ul className="space-y-1">
                  {data.risks.map((s, i) => (
                    <li key={i} className="text-sm text-foreground">{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {data.tips?.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Lightbulb className="h-3.5 w-3.5 text-warning" /> Suggestions
                </p>
                <ul className="space-y-1">
                  {data.tips.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="text-warning">•</span><span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
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
