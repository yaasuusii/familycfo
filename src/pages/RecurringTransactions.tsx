import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories } from "@/hooks/useFinanceData";
import {
  useRecurringIncome, useRecurringExpenses,
  useCreateRecurringIncome, useCreateRecurringExpense,
  useUpdateRecurring, useDeleteRecurring,
} from "@/hooks/useRecurringData";
import { useRecurringSuggestions } from "@/hooks/useRecurringSuggestions";
import type { RecurringSuggestion } from "@/lib/recurring-detect";
import { formatETB } from "@/lib/format";
import { Plus, Pause, Play, Trash2, History, Sparkles, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

const INCOME_SOURCES = ["Salary", "Business", "Other"];
type FormInitial = { title: string; group: string; amount: number; frequency: string };

function getNextDueDate(rule: { start_date: string; last_generated_date: string | null; frequency: string }): string {
  const base = rule.last_generated_date ? new Date(rule.last_generated_date) : new Date(rule.start_date);
  if (!rule.last_generated_date) return rule.start_date;
  const d = new Date(base);
  if (rule.frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (rule.frequency === "monthly") d.setMonth(d.getMonth() + 1);
  else if (rule.frequency === "yearly") d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split("T")[0];
}

export default function RecurringTransactions() {
  const { role, user } = useAuth();
  const isAdmin = role === "admin";
  const { data: incomeRules = [] } = useRecurringIncome();
  const { data: expenseRules = [] } = useRecurringExpenses();
  const { data: categories = [] } = useCategories();

  const createIncome = useCreateRecurringIncome();
  const createExpense = useCreateRecurringExpense();
  const updateIncome = useUpdateRecurring("recurring_income");
  const updateExpense = useUpdateRecurring("recurring_expenses");
  const deleteIncome = useDeleteRecurring("recurring_income");
  const deleteExpense = useDeleteRecurring("recurring_expenses");

  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [historyId, setHistoryId] = useState<{ id: string; type: "income" | "expense" } | null>(null);

  // Suggested recurring rules (deterministic detection, no AI).
  const { incomeSuggestions, expenseSuggestions, dismiss } = useRecurringSuggestions();
  const [incomeInitial, setIncomeInitial] = useState<FormInitial | null>(null);
  const [expenseInitial, setExpenseInitial] = useState<FormInitial | null>(null);

  const addFromSuggestion = (s: RecurringSuggestion) => {
    const initial: FormInitial = { title: s.title, group: s.group, amount: s.amount, frequency: s.frequency };
    if (s.kind === "income") {
      setIncomeInitial(initial);
      setShowAddIncome(true);
    } else {
      setExpenseInitial(initial);
      setShowAddExpense(true);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Family CFO</p>
        <h2 className="font-display text-3xl font-semibold tracking-tight">Recurring Transactions</h2>
      </div>

      <Tabs defaultValue="income">
        <TabsList>
          <TabsTrigger value="income">Recurring Income</TabsTrigger>
          <TabsTrigger value="expenses">Recurring Expenses</TabsTrigger>
        </TabsList>

        <TabsContent value="income" className="space-y-4">
          {isAdmin && (
            <Dialog open={showAddIncome} onOpenChange={(o) => { setShowAddIncome(o); if (!o) setIncomeInitial(null); }}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => setIncomeInitial(null)}><Plus className="h-4 w-4 mr-1" />Add Recurring Income</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Recurring Income</DialogTitle></DialogHeader>
                <AddIncomeForm key={incomeInitial?.title ?? "new"} userId={user?.id ?? ""} initial={incomeInitial} onSuccess={() => { setShowAddIncome(false); setIncomeInitial(null); }} mutate={createIncome} />
              </DialogContent>
            </Dialog>
          )}

          {isAdmin && incomeSuggestions.length > 0 && (
            <SuggestionList suggestions={incomeSuggestions} onAdd={addFromSuggestion} onDismiss={dismiss} />
          )}
          <Card>
            <CardContent className="p-0">
              {/* Mobile card list */}
              <div className="space-y-2 p-3 md:hidden">
                {incomeRules.map((r) => (
                  <div key={r.id} className="rounded-lg border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{r.title}</p>
                        <p className="text-xs capitalize text-muted-foreground">{r.frequency} · Next {getNextDueDate(r)}</p>
                      </div>
                      <Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Active" : "Paused"}</Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-semibold">{formatETB(Number(r.amount))}</span>
                      {isAdmin && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => updateIncome.mutate({ id: r.id, is_active: !r.is_active })}>
                            {r.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setHistoryId({ id: r.id, type: "income" })}>
                            <History className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={() => { deleteIncome.mutate(r.id); toast.success("Deleted"); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {incomeRules.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">No recurring income rules</p>
                )}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Next Due</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomeRules.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.title}</TableCell>
                      <TableCell>{formatETB(Number(r.amount))}</TableCell>
                      <TableCell className="capitalize">{r.frequency}</TableCell>
                      <TableCell>{getNextDueDate(r)}</TableCell>
                      <TableCell><Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Active" : "Paused"}</Badge></TableCell>
                      {isAdmin && (
                        <TableCell className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => updateIncome.mutate({ id: r.id, is_active: !r.is_active })}>
                            {r.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setHistoryId({ id: r.id, type: "income" })}>
                            <History className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { deleteIncome.mutate(r.id); toast.success("Deleted"); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {incomeRules.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No recurring income rules</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          {isAdmin && (
            <Dialog open={showAddExpense} onOpenChange={(o) => { setShowAddExpense(o); if (!o) setExpenseInitial(null); }}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => setExpenseInitial(null)}><Plus className="h-4 w-4 mr-1" />Add Recurring Expense</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Recurring Expense</DialogTitle></DialogHeader>
                <AddExpenseForm key={expenseInitial?.title ?? "new"} userId={user?.id ?? ""} initial={expenseInitial} categories={categories} onSuccess={() => { setShowAddExpense(false); setExpenseInitial(null); }} mutate={createExpense} />
              </DialogContent>
            </Dialog>
          )}

          {isAdmin && expenseSuggestions.length > 0 && (
            <SuggestionList suggestions={expenseSuggestions} onAdd={addFromSuggestion} onDismiss={dismiss} />
          )}
          <Card>
            <CardContent className="p-0">
              {/* Mobile card list */}
              <div className="space-y-2 p-3 md:hidden">
                {expenseRules.map((r) => (
                  <div key={r.id} className="rounded-lg border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{r.title}</p>
                        <p className="text-xs text-muted-foreground">{r.category}</p>
                        <p className="text-xs capitalize text-muted-foreground">{r.frequency} · Next {getNextDueDate(r)}</p>
                      </div>
                      <Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Active" : "Paused"}</Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-semibold">{formatETB(Number(r.amount))}</span>
                      {isAdmin && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => updateExpense.mutate({ id: r.id, is_active: !r.is_active })}>
                            {r.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setHistoryId({ id: r.id, type: "expense" })}>
                            <History className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={() => { deleteExpense.mutate(r.id); toast.success("Deleted"); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {expenseRules.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">No recurring expense rules</p>
                )}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Next Due</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseRules.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.title}</TableCell>
                      <TableCell>{r.category}</TableCell>
                      <TableCell>{formatETB(Number(r.amount))}</TableCell>
                      <TableCell className="capitalize">{r.frequency}</TableCell>
                      <TableCell>{getNextDueDate(r)}</TableCell>
                      <TableCell><Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Active" : "Paused"}</Badge></TableCell>
                      {isAdmin && (
                        <TableCell className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => updateExpense.mutate({ id: r.id, is_active: !r.is_active })}>
                            {r.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setHistoryId({ id: r.id, type: "expense" })}>
                            <History className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { deleteExpense.mutate(r.id); toast.success("Deleted"); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {expenseRules.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No recurring expense rules</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* History Dialog */}
      <Dialog open={!!historyId} onOpenChange={() => setHistoryId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Generated Entry History</DialogTitle></DialogHeader>
          {historyId && <HistoryList recurringId={historyId.id} type={historyId.type} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SuggestionList({ suggestions, onAdd, onDismiss }: {
  suggestions: RecurringSuggestion[];
  onAdd: (s: RecurringSuggestion) => void;
  onDismiss: (key: string) => void;
}) {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.05] to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-primary" /> Suggested from your history
        </CardTitle>
        <p className="text-xs text-muted-foreground">Repeating transactions we spotted. Review and add — nothing is created automatically.</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {suggestions.map((s) => (
          <div key={s.key} className="flex items-center gap-3 rounded-lg border bg-card p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium">{s.title}</p>
                <Badge variant="outline" className="shrink-0 capitalize">{s.frequency}</Badge>
                {s.confidence === "high" && <Badge variant="secondary" className="shrink-0">Strong</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {s.group} · seen {s.months} months · last {s.lastDate}
              </p>
            </div>
            <span className="shrink-0 font-semibold tnum">{formatETB(s.amount)}</span>
            <div className="flex shrink-0 gap-1">
              <Button size="sm" onClick={() => onAdd(s)}>
                <Check className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Add</span>
              </Button>
              <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => onDismiss(s.key)} aria-label="Dismiss">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function HistoryList({ recurringId, type }: { recurringId: string; type: "income" | "expense" }) {
  const table = type === "income" ? "income" : "expenses";
  const { data = [] } = useQuery({
    queryKey: ["recurring_history", recurringId],
    queryFn: async () => {
      const { data, error } = await supabase.from(table).select("*").eq("recurring_id", recurringId).order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="max-h-64 overflow-auto space-y-2">
      {data.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No entries generated yet</p>}
      {data.map((entry: any) => (
        <div key={entry.id} className="flex justify-between text-sm border-b pb-1">
          <span>{entry.date}</span>
          <span className="font-medium">{formatETB(Number(entry.amount))}</span>
        </div>
      ))}
    </div>
  );
}

function AddIncomeForm({ userId, onSuccess, mutate, initial }: { userId: string; onSuccess: () => void; mutate: any; initial?: FormInitial | null }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [source, setSource] = useState(initial && INCOME_SOURCES.includes(initial.group) ? initial.group : "Salary");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [frequency, setFrequency] = useState(initial?.frequency ?? "monthly");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [autoPost, setAutoPost] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate.mutate({
      title, source, amount: Number(amount), frequency, start_date: startDate,
      end_date: endDate || null, auto_post: autoPost, created_by: userId,
    }, { onSuccess: () => { onSuccess(); toast.success("Recurring income created"); } });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
      <div><Label>Source</Label>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Salary">Salary</SelectItem>
            <SelectItem value="Business">Business</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div><Label>Amount (ETB)</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
      <div><Label>Frequency</Label>
        <Select value={frequency} onValueChange={setFrequency}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="yearly">Yearly</SelectItem></SelectContent>
        </Select>
      </div>
      <div><Label>Start Date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></div>
      <div><Label>End Date (optional)</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
      <div className="flex items-center gap-2"><Switch checked={autoPost} onCheckedChange={setAutoPost} /><Label>Auto-post entries</Label></div>
      <Button type="submit" className="w-full" disabled={mutate.isPending}>Create</Button>
    </form>
  );
}

function AddExpenseForm({ userId, categories, onSuccess, mutate, initial }: { userId: string; categories: any[]; onSuccess: () => void; mutate: any; initial?: FormInitial | null }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(initial?.group ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [frequency, setFrequency] = useState(initial?.frequency ?? "monthly");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [autoPost, setAutoPost] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate.mutate({
      title, category, amount: Number(amount), frequency, start_date: startDate,
      end_date: endDate || null, auto_post: autoPost, created_by: userId,
    }, { onSuccess: () => { onSuccess(); toast.success("Recurring expense created"); } });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
      <div><Label>Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>Amount (ETB)</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
      <div><Label>Frequency</Label>
        <Select value={frequency} onValueChange={setFrequency}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="yearly">Yearly</SelectItem></SelectContent>
        </Select>
      </div>
      <div><Label>Start Date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></div>
      <div><Label>End Date (optional)</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
      <div className="flex items-center gap-2"><Switch checked={autoPost} onCheckedChange={setAutoPost} /><Label>Auto-post entries</Label></div>
      <Button type="submit" className="w-full" disabled={mutate.isPending}>Create</Button>
    </form>
  );
}
