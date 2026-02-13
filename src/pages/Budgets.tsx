import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBudgets, useCategories, useExpenses, getCurrentMonth } from "@/hooks/useFinanceData";
import { formatETB, formatPercent } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Plus, Trash2, AlertTriangle } from "lucide-react";

export default function Budgets() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const month = getCurrentMonth();
  const { data: budgets = [] } = useBudgets();
  const { data: categories = [] } = useCategories();
  const { data: expenses = [] } = useExpenses(month);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: "", monthly_limit: "" });

  const isAdmin = role === "admin";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("budgets").insert({
      category: form.category,
      monthly_limit: parseFloat(form.monthly_limit),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Budget set");
    setOpen(false);
    setForm({ category: "", monthly_limit: "" });
    queryClient.invalidateQueries({ queryKey: ["budgets"] });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("budgets").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Budget removed");
    queryClient.invalidateQueries({ queryKey: ["budgets"] });
  };

  const getActual = (category: string) => expenses.filter((e) => e.category === category).reduce((s, e) => s + Number(e.amount), 0);
  const unbudgetedCategories = categories.filter((c) => !budgets.some((b) => b.category === c.name));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Budgets</h2>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Set Budget</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Set Category Budget</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {unbudgetedCategories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Monthly Limit (ETB)</Label>
                  <Input type="number" step="0.01" min="0.01" value={form.monthly_limit} onChange={(e) => setForm({ ...form, monthly_limit: e.target.value })} required />
                </div>
                <Button type="submit" className="w-full">Save</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {budgets.map((b) => {
          const actual = getActual(b.category);
          const limit = Number(b.monthly_limit);
          const pct = limit > 0 ? (actual / limit) * 100 : 0;
          const exceeded = pct > 100;
          const remaining = limit - actual;
          return (
            <Card key={b.id} className={exceeded ? "border-destructive" : ""}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">{b.category}</CardTitle>
                {exceeded && <AlertTriangle className="h-4 w-4 text-destructive" />}
                {isAdmin && <Button variant="ghost" size="icon" onClick={() => handleDelete(b.id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>}
              </CardHeader>
              <CardContent className="space-y-2">
                <Progress value={Math.min(pct, 100)} className="h-2" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{formatETB(actual)} / {formatETB(limit)}</span>
                  <span className={exceeded ? "font-medium text-destructive" : "text-muted-foreground"}>{formatPercent(pct)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {exceeded ? `Over budget by ${formatETB(Math.abs(remaining))}` : `${formatETB(remaining)} remaining`}
                </p>
              </CardContent>
            </Card>
          );
        })}
        {budgets.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground py-8">No budgets set yet. {isAdmin ? "Click 'Set Budget' to get started." : "Ask admin to set budgets."}</p>
        )}
      </div>
    </div>
  );
}
