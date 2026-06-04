import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBudgets, useCategories, useExpenses } from "@/hooks/useFinanceData";
import { useBudgetCoach, type BudgetSuggestion } from "@/hooks/useBudgetCoach";
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
import { Money, RadialGauge, StatHeroCard, BudgetCategoryCard, Reveal, Panel, type HeroState } from "@/components/finance";
import { toast } from "sonner";
import { Plus, Trash2, AlertTriangle, Pencil, ShieldAlert, Sparkles, RefreshCw, Loader2, Check, TrendingUp, TrendingDown, Minus, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = role === "admin";

  // Self-transfers move money between own accounts — never count them as spend.
  const getActual = (category: string) =>
    expenses.filter((e) => e.category === category && !e.is_self_transfer).reduce((s, e) => s + Number(e.amount), 0);

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

  const coach = useBudgetCoach(selMonth, selYear, budgets as any);
  const [applying, setApplying] = useState<string | null>(null);

  const applySuggestion = async (s: BudgetSuggestion) => {
    if (!isAdmin || applying) return;
    setApplying(s.category);
    try {
      const { error } = s.budgetId
        ? await supabase.from("budgets").update({ monthly_limit: s.suggestedLimit }).eq("id", s.budgetId)
        : await supabase.from("budgets").insert({
            category: s.category,
            monthly_limit: s.suggestedLimit,
            month: selMonth,
            year: selYear,
          });
      if (error) { toast.error(error.message); return; }
      toast.success(`${s.category}: limit set to ${formatETB(s.suggestedLimit)}`);
      queryClient.invalidateQueries({ queryKey: ["budgets", selMonth, selYear] });
    } finally {
      setApplying(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
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
    } finally {
      setSubmitting(false);
    }
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
  const budgetState: HeroState = anyExceeded ? "bad" : overallWarning ? "warn" : "good";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Family CFO</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">Budgets</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{getEthiopianMonthName(selMonth)} {selYear}</p>
        </div>
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
                  <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Saving…" : editId ? "Update" : "Save"}</Button>
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

      {/* Budget Coach */}
      {isAdmin && (
        <BudgetCoachCard coach={coach} applying={applying} onApply={applySuggestion} />
      )}

      {/* Overview summary */}
      {budgetStats.length > 0 && (
        <Reveal>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel className="flex items-center gap-5">
              <RadialGauge value={overallPct} caption="used" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Budget</span>
                  <Money amount={totalBudget} className="text-sm text-foreground" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Spent</span>
                  <Money amount={totalSpent} className="text-sm text-foreground" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Remaining</span>
                  <Money amount={totalBudget - totalSpent} className="text-sm text-foreground" />
                </div>
              </div>
            </Panel>
            <StatHeroCard
              state={budgetState}
              label="Overall Usage"
              value={formatPercent(overallPct)}
              subtitle={`${formatETB(totalSpent)} of ${formatETB(totalBudget)}`}
              footer={
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/25">
                  <div className="h-full rounded-full bg-white/90" style={{ width: `${Math.min(overallPct, 100)}%` }} />
                </div>
              }
            />
          </div>
        </Reveal>
      )}

      {/* Budget cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {budgetStats.map((b) => (
          <div key={b.id} className="group relative">
            <BudgetCategoryCardWithControls
              category={b.category}
              spent={b.actual}
              limit={b.limit}
              isAdmin={isAdmin}
              onEdit={() => handleEdit(b)}
              onDelete={() => handleDelete(b.id)}
            />
          </div>
        ))}
        {budgetStats.length === 0 && (
          <p className="col-span-full py-10 text-center text-muted-foreground">
            No budgets set for {getEthiopianMonthName(selMonth)} {selYear}. {isAdmin ? "Click 'Set Budget' to get started." : "Ask admin to set budgets."}
          </p>
        )}
      </div>
    </div>
  );
}

const TREND_ICON = {
  up: <TrendingUp className="h-3.5 w-3.5 text-destructive" />,
  down: <TrendingDown className="h-3.5 w-3.5 text-success" />,
  flat: <Minus className="h-3.5 w-3.5 text-muted-foreground" />,
};

function BudgetCoachCard({
  coach, applying, onApply,
}: {
  coach: ReturnType<typeof useBudgetCoach>;
  applying: string | null;
  onApply: (s: BudgetSuggestion) => void;
}) {
  const { suggestions, coach: ai, loading } = coach;

  if (loading && suggestions.length === 0) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent">
        <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Reviewing your spending history…
        </CardContent>
      </Card>
    );
  }
  if (suggestions.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Budget Coach</CardTitle>
            <p className="text-xs text-muted-foreground">Suggested limits from your last 3 months</p>
          </div>
        </div>
        {coach.canRefresh && (
          <Button variant="outline" size="sm" onClick={coach.refresh} disabled={coach.generating}>
            {coach.generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-1 hidden sm:inline">Refresh</span>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {ai?.summary && <p className="text-sm font-medium leading-relaxed text-foreground">{ai.summary}</p>}

        <div className="space-y-2">
          {suggestions.map((s) => {
            const matched = s.currentLimit === s.suggestedLimit;
            return (
              <div key={s.category} className="flex items-center gap-3 rounded-lg border border-border bg-card/60 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-foreground">{s.category}</span>
                    {TREND_ICON[s.trend]}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Avg {formatETB(s.avgSpend)}/mo
                    {s.currentLimit != null && ` · now ${formatETB(s.currentLimit)}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-sm font-semibold tabular-nums text-foreground">{formatETB(s.suggestedLimit)}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">suggested</p>
                </div>
                {matched ? (
                  <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                    <Check className="mr-1 h-3 w-3" />Set
                  </Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => onApply(s)} disabled={applying === s.category}>
                    {applying === s.category ? <Loader2 className="h-4 w-4 animate-spin" /> : s.currentLimit != null ? "Update" : "Apply"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {ai?.tips && ai.tips.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Lightbulb className="h-3.5 w-3.5 text-warning" /> Suggestions
            </p>
            <ul className="space-y-1">
              {ai.tips.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="text-warning">•</span><span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BudgetCategoryCardWithControls({
  category, spent, limit, isAdmin, onEdit, onDelete,
}: {
  category: string; spent: number; limit: number;
  isAdmin: boolean; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div className="relative">
      <BudgetCategoryCard category={category} spent={spent} limit={limit} />
      {isAdmin && (
        <div className="absolute right-2 top-2 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      )}
    </div>
  );
}
