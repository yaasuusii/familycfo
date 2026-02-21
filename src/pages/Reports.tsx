import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIncome, useExpenses, getCurrentMonth } from "@/hooks/useFinanceData";
import { useLoans, useLoanRepayments } from "@/hooks/useLoanData";
import { formatETB } from "@/lib/format";
import { Download } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line } from "recharts";

export default function Reports() {
  const [month, setMonth] = useState(getCurrentMonth());
  const { data: income = [] } = useIncome(month);
  const { data: expenses = [] } = useExpenses(month);
  const { data: allLoans = [] } = useLoans();

  const totalIncome = income.reduce((s, i) => s + Number(i.amount), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const loanRepaymentTotal = useMemo(() => expenses.filter((e) => e.category === "Loan Repayment").reduce((s, e) => s + Number(e.amount), 0), [expenses]);

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => { map[e.category] = (map[e.category] || 0) + Number(e.amount); });
    return Object.entries(map).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const incomeVsExpense = [{ name: "Income", amount: totalIncome }, { name: "Expenses", amount: totalExpenses }];

  const months = useMemo(() => {
    const arr: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return arr;
  }, []);

  // Net Liability vs Assets
  const activeLoans = useMemo(() => allLoans.filter((l) => l.status === "active"), [allLoans]);
  const totalLiability = activeLoans.filter((l) => l.loan_type === "taken").reduce((s, l) => s + Number(l.remaining_balance), 0);
  const totalAssets = activeLoans.filter((l) => l.loan_type === "given").reduce((s, l) => s + Number(l.remaining_balance), 0);
  const liabilityVsAssets = [{ name: "Liabilities (Taken)", amount: totalLiability }, { name: "Assets (Given)", amount: totalAssets }];

  const exportCSV = () => {
    const rows = [["Type", "Date", "Category/Source", "Amount", "Notes"].join(",")];
    income.forEach((i) => rows.push(["Income", i.date, i.source, String(i.amount), `"${i.notes || ""}"`].join(",")));
    expenses.forEach((e) => rows.push(["Expense", e.date, e.category, String(e.amount), `"${e.notes || ""}"`].join(",")));
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${month}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Reports</h2>
        <div className="flex gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCSV}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Income</p><p className="text-xl font-bold text-success">{formatETB(totalIncome)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Expenses</p><p className="text-xl font-bold text-destructive">{formatETB(totalExpenses)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Net</p><p className={`text-xl font-bold ${totalIncome - totalExpenses >= 0 ? "text-success" : "text-destructive"}`}>{formatETB(totalIncome - totalExpenses)}</p></CardContent></Card>
      </div>

      {/* Loan Repayments Summary */}
      {loanRepaymentTotal > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Loan Repayments This Month</p>
            <p className="text-xl font-bold text-foreground">{formatETB(loanRepaymentTotal)}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Income vs Expenses</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={incomeVsExpense}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(v: number) => formatETB(v)} />
              <Bar dataKey="amount" fill="hsl(220,70%,50%)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Net Liability vs Assets */}
      {(totalLiability > 0 || totalAssets > 0) && (
        <Card>
          <CardHeader><CardTitle className="text-base">Net Liability vs Assets</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={liabilityVsAssets}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(v: number) => formatETB(v)} />
                <Bar dataKey="amount" fill="hsl(38,92%,50%)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Category Breakdown</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoryBreakdown.map((c) => (
                <TableRow key={c.category}>
                  <TableCell>{c.category}</TableCell>
                  <TableCell className="font-medium">{formatETB(c.amount)}</TableCell>
                  <TableCell>{totalExpenses > 0 ? ((c.amount / totalExpenses) * 100).toFixed(1) : 0}%</TableCell>
                </TableRow>
              ))}
              {categoryBreakdown.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No expenses this month</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
