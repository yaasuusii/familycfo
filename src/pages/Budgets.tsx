import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBudgets, useCategories, useExpenses } from "@/hooks/useFinanceData";
import { formatETB, formatPercent } from "@/lib/format";
import { getCurrentEthiopianMonth, getEthiopianMonthName, getEthiopianMonthDateRange } from "@/lib/ethiopian-calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Plus, Trash2, AlertTriangle, Pencil, ShieldAlert, TrendingUp } from "lucide-react";

const ETH_MONTHS = Array.from({ length: 13 }, (_, i) => ({
  value: i + 1,
  label: getEthiopianMonthName(i + 1),
}));

function getStatus(pct: number) {
  if (pct >= 100) return { label: "Exceeded", color: "text-destructive", bg: "bg-destructive", border: "border-destructive" };
  if (pct >= 80) return { label: "Warning", color: "text-warning", bg: "bg-warning", border: "border-warning" };
  return { label: "Safe", color: "text-success", bg: "bg-success", border: "" };
}

export default function Budgets() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const ethNow = getCurrentEthiopianMonth();
  const [selMonth, setSelMonth] = useState(ethNow.month);
  const [selYear, setSelYear] = useState(ethNow.year);

  const ethMonthStr = `${selYear}-${String(selMonth).padStart(2, "0")}`;
  const { data: budgets = [] } = useBudgets(selMonth, selYear);
  const { data: categories = [] } = useCategories();
  const { data: expenses = [] } = useExpenses(ethMonthStr);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ category: "", monthly_limit: "" });

  const isAdmin = role === "admin";

  const getActual = (category: string) =>
    expenses.filter((e) => e.category === category).reduce((s, e) => s + Number(e.amount), 0);

  const budgetStats = useMemo(() => {
    return budgets.map((b) => {
      const actual = getActual(b.category);
      const limit = Number(b.monthly_limit);
      const pct = limit > 0 ? (actual / limit) * 100 : 0;
      const remaining = limit - actual;
      const status = getStatus(pct);
      return { ...b, actual, limit, pct, remaining, status };
    });
  }, [budgets, expenses]);

  const totalBudget = budgetStats.reduce((s, b) => s + b.limit, 0);
  const totalSpent = budgetStats.reduce((s, b) => s + b.actual, 0);
  const overallPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const anyExceeded = budgetStats.some((b) => b.pct >= 100);
  const overallWarning = overallPct > 90;

  const unbudgetedCategories = categories.filter((c) => !budgets.some((b) => b.category === c.name));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editId) {
      const { error } = await supabase.from("budgets").update({
        monthly_limit: parseFloat(form.monthly_limit),
      }).eq("id", editId);
      if (error) { toast.error(error.message); return; }
      toast.success("Budget updated");
    } else {
      const { error } = await supabase.from("budgets").insert({
        category: form.category,
        monthly_limit: parseFloat(form.monthly_limit),
        month: selMonth,
        year: selYear,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Budget set");
    }
    setOpen(false);
    setEditId(null);
    setForm({ category: "", monthly_limit: "" });
    queryClient.invalidateQueries({ queryKey: ["budgets", selMonth, selYear] });
  };

  const handleEdit = (b: typeof budgetStats[0]) => {
    setEditId(b.id);
    setForm({ category: b.category, monthly_limit: String(b.limit) });
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("budgets").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Budget removed");
    queryClient.invalidateQueries({ queryKey: ["budgets", selMonth, selYear] });
  };

  const openNew = () => {
    setEditId(null);
    setForm({ category: "", monthly_limit: "" });
    setOpen(true);
  };

  const years = Array.from({ length: 5 }, (_, i) => ethNow.year - 2 + i);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-foreground">Budgets</h2>
        <div className="flex items-center gap-2">
          <Select value={String(selMonth)} onValueChange={(v) => setSelMonth(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ETH_MONTHS.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(selYear)} onValueChange={(v) => setSelYear(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditId(null); }}>
              <DialogTrigger asChild>
                <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Set Budget</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editId ? "Edit Budget" : "Set Category Budget"}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {!editId && (
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                        <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                        <SelectContent>
                          {unbudgetedCategories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {editId && (
                    <p className="text-sm text-muted-foreground">Category: <span className="font-medium text-foreground">{form.category}</span></p>
                  )}
                  <div className="space-y-2">
                    <Label>Monthly Limit (ETB)</Label>
                    <Input type="number" step="0.01" min="0.01" value={form.monthly_limit} onChange={(e) => setForm({ ...form, monthly_limit: e.target.value })} required />
                  </div>
                  <Button type="submit" className="w-full">{editId ? "Update" : "Save"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Alert Banners */}
      {anyExceeded && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>One or more categories have exceeded their budget!</AlertDescription>
        </Alert>
      )}
      {!anyExceeded && overallWarning && (
        <Alert className="border-warning/50 text-warning [&>svg]:text-warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Overall budget usage is above 90% ({formatPercent(overallPct)})</AlertDescription>
        </Alert>
      )}

      {/* Overview summary */}
      {budgetStats.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Budget</p>
                <p className="text-lg font-semibold text-foreground">{formatETB(totalBudget)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <TrendingUp className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Spent</p>
                <p className="text-lg font-semibold text-foreground">{formatETB(totalSpent)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <TrendingUp className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Overall Usage</p>
                <p className={`text-lg font-semibold ${getStatus(overallPct).color}`}>{formatPercent(overallPct)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Budget cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {budgetStats.map((b) => (
          <Card key={b.id} className={b.status.border ? `border-2 ${b.status.border}` : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">{b.category}</CardTitle>
              <div className="flex items-center gap-1">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${b.status.bg} text-white`}>
                  {b.status.label}
                </span>
                {isAdmin && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(b)}><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(b.id)}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Progress value={Math.min(b.pct, 100)} className={`h-2.5 [&>div]:${b.status.bg}`} />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{formatETB(b.actual)} / {formatETB(b.limit)}</span>
                <span className={b.status.color + " font-medium"}>{formatPercent(b.pct)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {b.pct >= 100 ? `Over budget by ${formatETB(Math.abs(b.remaining))}` : `${formatETB(b.remaining)} remaining`}
              </p>
            </CardContent>
          </Card>
        ))}
        {budgetStats.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground py-8">
            No budgets set for {getEthiopianMonthName(selMonth)} {selYear}. {isAdmin ? "Click 'Set Budget' to get started." : "Ask admin to set budgets."}
          </p>
        )}
      </div>
    </div>
  );
}
