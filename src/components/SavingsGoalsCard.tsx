import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSavingsGoals, useSaveSavingsGoal, useDeleteSavingsGoal, type SavingsGoal } from "@/hooks/useSavingsGoals";
import { Money, SectionHeader, Panel } from "@/components/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PiggyBank, Plus, Pencil, Trash2, Check } from "lucide-react";

type Editing = { id?: string; name: string; target_amount: string; current_amount: string };
const EMPTY: Editing = { name: "", target_amount: "", current_amount: "" };

export function SavingsGoalsCard() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const { data: goals = [] } = useSavingsGoals();
  const save = useSaveSavingsGoal();
  const del = useDeleteSavingsGoal();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Editing>(EMPTY);

  if (goals.length === 0 && !isAdmin) return null;

  const openNew = () => { setForm(EMPTY); setOpen(true); };
  const openEdit = (g: SavingsGoal) => {
    setForm({ id: g.id, name: g.name, target_amount: String(g.target_amount), current_amount: String(g.current_amount) });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(form.target_amount);
    const current = parseFloat(form.current_amount || "0");
    if (!form.name.trim() || !(target > 0)) { toast.error("Enter a name and a target above 0"); return; }
    try {
      await save.mutateAsync({ id: form.id, name: form.name.trim(), target_amount: target, current_amount: Math.max(current, 0) });
      toast.success(form.id ? "Goal updated" : "Goal added");
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const remove = async (id: string) => {
    try { await del.mutateAsync(id); toast.success("Goal removed"); }
    catch (err) { toast.error((err as Error).message); }
  };

  return (
    <Panel>
      <div className="flex items-start justify-between">
        <SectionHeader title="Savings Goals" caption="Progress toward targets" />
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" /><span className="ml-1 hidden sm:inline">Add</span>
          </Button>
        )}
      </div>

      <div className="mt-3 space-y-3">
        {goals.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No goals yet.{isAdmin && " Add one to start tracking."}
          </p>
        ) : (
          goals.map((g) => {
            const pct = g.target_amount > 0 ? Math.min((g.current_amount / g.target_amount) * 100, 100) : 0;
            const done = g.current_amount >= g.target_amount;
            return (
              <div key={g.id} className="group">
                <div className="mb-1 flex items-center gap-2 text-sm">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                    {done ? <Check className="h-3.5 w-3.5" /> : <PiggyBank className="h-3.5 w-3.5" />}
                  </span>
                  <span className="font-medium text-foreground">{g.name}</span>
                  <span className="ml-auto tnum text-muted-foreground">
                    <Money amount={g.current_amount} hideCents className="text-sm" /> / <Money amount={g.target_amount} hideCents className="text-sm" />
                  </span>
                  {isAdmin && (
                    <span className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(g)}>
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(g.id)}>
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </span>
                  )}
                </div>
                <Progress value={pct} className={`h-2 ${done ? "[&>div]:bg-success" : ""}`} />
              </div>
            );
          })
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? "Edit Goal" : "New Savings Goal"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Emergency fund" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Target (ETB)</Label>
                <Input type="number" step="0.01" min="0.01" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Saved so far</Label>
                <Input type="number" step="0.01" min="0" value={form.current_amount} onChange={(e) => setForm({ ...form, current_amount: e.target.value })} placeholder="0" />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={save.isPending}>
              {save.isPending ? "Saving…" : form.id ? "Update" : "Add goal"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
