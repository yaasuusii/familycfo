import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useExpenses, useCategories, useProfiles, getCurrentMonth } from "@/hooks/useFinanceData";
import { formatETB } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

const PAYMENT_METHODS = ["Cash", "CBE", "BOA", "127"] as const;
type PaymentMethod = typeof PAYMENT_METHODS[number];

const PAYMENT_BADGE: Record<PaymentMethod, string> = {
  Cash:  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  CBE:   "bg-blue-100   text-blue-800   dark:bg-blue-900/40   dark:text-blue-300",
  BOA:   "bg-red-100    text-red-800    dark:bg-red-900/40    dark:text-red-300",
  "127": "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
};

function PaymentBadge({ method }: { method: string }) {
  const cls = PAYMENT_BADGE[method as PaymentMethod] ?? "bg-secondary text-foreground";
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {method}
    </span>
  );
}

export default function Expenses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const month = getCurrentMonth();
  const { data: expenses = [] } = useExpenses(month);
  const { data: categories = [] } = useCategories();
  const { data: profiles = [] } = useProfiles();
  const [open, setOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), category: "Grocery", amount: "", payment_method: "CBE", notes: "" });

  const filtered = expenses.filter((e) => {
    if (filterCategory !== "all" && e.category !== filterCategory) return false;
    if (filterUser !== "all" && e.user_id !== filterUser) return false;
    if (filterPayment !== "all" && e.payment_method !== filterPayment) return false;
    return true;
  });

  const totalFiltered = filtered.reduce((s, e) => s + Number(e.amount), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("expenses").insert({
      user_id: user.id,
      date: form.date,
      category: form.category,
      amount: parseFloat(form.amount),
      payment_method: form.payment_method,
      notes: form.notes || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Expense added");
    setOpen(false);
    setForm({ date: new Date().toISOString().slice(0, 10), category: "Grocery", amount: "", payment_method: "CBE", notes: "" });
    queryClient.invalidateQueries({ queryKey: ["expenses"] });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    queryClient.invalidateQueries({ queryKey: ["expenses"] });
  };

  const handleCategoryChange = async (id: string, category: string) => {
    const { error } = await supabase.from("expenses").update({ category }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Category updated");
    queryClient.invalidateQueries({ queryKey: ["expenses"] });
  };

  const getUserName = (uid: string) => profiles.find((p) => p.user_id === uid)?.name ?? "Unknown";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Expenses</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Expense</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Amount (ETB)</Label>
                  <Input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Account / Payment</Label>
                  <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          <span className="flex items-center gap-2">
                            <PaymentBadge method={m} />
                            {m === "CBE" && "Commercial Bank of Ethiopia"}
                            {m === "BOA" && "Bank of Abyssinia"}
                            {m === "127" && "Telebirr (127)"}
                            {m === "Cash" && "Cash"}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <Button type="submit" className="w-full">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterUser} onValueChange={setFilterUser}>
          <SelectTrigger className="w-40"><SelectValue placeholder="User" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPayment} onValueChange={setFilterPayment}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Account" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {PAYMENT_METHODS.map((m) => (
              <SelectItem key={m} value={m}><PaymentBadge method={m} /></SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Total: {formatETB(totalFiltered)}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Added By</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.date}</TableCell>
                  <TableCell>
                    {e.user_id === user?.id ? (
                      <Select value={e.category} onValueChange={(v) => handleCategoryChange(e.id, v)}>
                        <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      e.category
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{formatETB(Number(e.amount))}</TableCell>
                  <TableCell><PaymentBadge method={e.payment_method} /></TableCell>
                  <TableCell>{getUserName(e.user_id)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{e.notes}</TableCell>
                  <TableCell>
                    {e.user_id === user?.id && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No expenses found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
