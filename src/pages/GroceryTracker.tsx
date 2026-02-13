import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useExpenses, getCurrentMonth } from "@/hooks/useFinanceData";
import { formatETB, formatPercent } from "@/lib/format";
import { ShoppingCart, TrendingDown, Percent, CalendarDays } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";

export default function GroceryTracker() {
  const month = getCurrentMonth();
  const { data: allExpenses = [] } = useExpenses(month);

  const groceryExpenses = useMemo(() => allExpenses.filter((e) => e.category === "Grocery"), [allExpenses]);
  const totalGrocery = groceryExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalExpenses = allExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const groceryPercent = totalExpenses > 0 ? (totalGrocery / totalExpenses) * 100 : 0;

  // Average weekly
  const now = new Date();
  const weeksElapsed = Math.max(1, Math.ceil(now.getDate() / 7));
  const avgWeekly = totalGrocery / weeksElapsed;

  // Trend
  const trend = useMemo(() => {
    const map: Record<string, number> = {};
    groceryExpenses.forEach((e) => { map[e.date] = (map[e.date] || 0) + Number(e.amount); });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date: date.slice(5), amount }));
  }, [groceryExpenses]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Grocery Tracker</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Monthly Grocery Total" value={formatETB(totalGrocery)} icon={<ShoppingCart className="h-4 w-4 text-warning" />} />
        <StatCard title="Avg Weekly Cost" value={formatETB(avgWeekly)} icon={<CalendarDays className="h-4 w-4 text-primary" />} />
        <StatCard title="% of Total Expenses" value={formatPercent(groceryPercent)} icon={<Percent className="h-4 w-4 text-success" />} />
        <StatCard title="Transactions" value={String(groceryExpenses.length)} icon={<TrendingDown className="h-4 w-4 text-muted-foreground" />} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Grocery Spending Trend</CardTitle></CardHeader>
        <CardContent>
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trend}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatETB(v)} />
                <Line type="monotone" dataKey="amount" stroke="hsl(38,92%,50%)" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-muted-foreground py-8">No grocery expenses yet</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
