import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIncome, useExpenses, useBudgets, getCurrentMonth } from "@/hooks/useFinanceData";
import { formatETB, formatPercent } from "@/lib/format";
import { TrendingUp, TrendingDown, Wallet, ShoppingCart, PiggyBank, Target } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, Legend } from "recharts";

const COLORS = ["hsl(220,70%,50%)", "hsl(142,71%,45%)", "hsl(38,92%,50%)", "hsl(280,65%,60%)", "hsl(0,72%,51%)", "hsl(190,80%,45%)", "hsl(330,65%,55%)"];

export default function Dashboard() {
  const month = getCurrentMonth();
  const { data: income = [] } = useIncome(month);
  const { data: expenses = [] } = useExpenses(month);
  const { data: budgets = [] } = useBudgets();

  const totalIncome = useMemo(() => income.reduce((s, i) => s + Number(i.amount), 0), [income]);
  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses]);
  const remaining = totalIncome - totalExpenses;
  const grocerySpend = useMemo(() => expenses.filter((e) => e.category === "Grocery").reduce((s, e) => s + Number(e.amount), 0), [expenses]);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  // Category breakdown for pie chart
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => { map[e.category] = (map[e.category] || 0) + Number(e.amount); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  // Daily trend for line chart
  const dailyTrend = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => { map[e.date] = (map[e.date] || 0) + Number(e.amount); });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date: date.slice(5), amount }));
  }, [expenses]);

  // Budget vs Actual
  const budgetComparison = useMemo(() => {
    return budgets.map((b) => {
      const actual = expenses.filter((e) => e.category === b.category).reduce((s, e) => s + Number(e.amount), 0);
      return { category: b.category, budget: Number(b.monthly_limit), actual };
    });
  }, [budgets, expenses]);

  // Forecast
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projectedExpenses = dayOfMonth > 0 ? (totalExpenses / dayOfMonth) * daysInMonth : 0;
  const projectedRemaining = totalIncome - projectedExpenses;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryCard title="Monthly Income" value={formatETB(totalIncome)} icon={<TrendingUp className="h-4 w-4 text-success" />} />
        <SummaryCard title="Monthly Expenses" value={formatETB(totalExpenses)} icon={<TrendingDown className="h-4 w-4 text-destructive" />} />
        <SummaryCard title="Remaining" value={formatETB(remaining)} icon={<Wallet className="h-4 w-4 text-primary" />} />
        <SummaryCard title="Grocery" value={formatETB(grocerySpend)} icon={<ShoppingCart className="h-4 w-4 text-warning" />} />
        <SummaryCard title="Savings Rate" value={formatPercent(savingsRate)} icon={<PiggyBank className="h-4 w-4 text-success" />} />
        <SummaryCard title="Projected Balance" value={formatETB(projectedRemaining)} icon={<Target className="h-4 w-4 text-primary" />} />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Pie chart */}
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

        {/* Line chart */}
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

      {/* Budget comparison */}
      {budgetComparison.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Budget vs Actual</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={budgetComparison}>
                <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatETB(v)} />
                <Legend />
                <Bar dataKey="budget" fill="hsl(220,70%,50%)" name="Budget" />
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
