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
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2, X, ListFilter } from "lucide-react";

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

  const activeFilterCount = [filterCategory, filterUser, filterPayment].filter((f) => f !== "all").length;

  const clearAllFilters = () => {
    setFilterCategory("all");
    setFilterUser("all");
    setFilterPayment("all");
  };

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

      {/* Active filter chips — only visible when filtering */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Filtered by:</span>
          {filterCategory !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1 font-normal">
              Category: {filterCategory}
              <button onClick={() => setFilterCategory("all")} className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {filterUser !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1 font-normal">
              User: {getUserName(filterUser)}
              <button onClick={() => setFilterUser("all")} className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {filterPayment !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1 font-normal">
              Account: <PaymentBadge method={filterPayment} />
              <button onClick={() => setFilterPayment("all")} className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"><X className="h-3 w-3" /></button>
            </Badge>
          )}
          <button onClick={clearAllFilters} className="text-xs text-muted-foreground hover:text-foreground underline ml-1">Clear all</button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Total: {formatETB(totalFiltered)}</span>
            <span className="text-sm font-normal text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
              {activeFilterCount > 0 ? ` (of ${expenses.length})` : ""}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>

                {/* Category — filterable */}
                <TableHead>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                        Category
                        <ListFilter className={`h-3.5 w-3.5 ${filterCategory !== "all" ? "text-primary" : "text-muted-foreground"}`} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-2" align="start">
                      <div className="space-y-1">
                        <button
                          onClick={() => setFilterCategory("all")}
                          className={`w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent ${filterCategory === "all" ? "bg-accent font-medium" : ""}`}
                        >All Categories</button>
                        {categories.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => setFilterCategory(c.name)}
                            className={`w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent ${filterCategory === c.name ? "bg-accent font-medium" : ""}`}
                          >{c.name}</button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </TableHead>

                <TableHead>Amount</TableHead>

                {/* Account — filterable */}
                <TableHead>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                        Account
                        <ListFilter className={`h-3.5 w-3.5 ${filterPayment !== "all" ? "text-primary" : "text-muted-foreground"}`} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-44 p-2" align="start">
                      <div className="space-y-1">
                        <button
                          onClick={() => setFilterPayment("all")}
                          className={`w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent ${filterPayment === "all" ? "bg-accent font-medium" : ""}`}
                        >All Accounts</button>
                        {PAYMENT_METHODS.map((m) => (
                          <button
                            key={m}
                            onClick={() => setFilterPayment(m)}
                            className={`w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent flex items-center gap-2 ${filterPayment === m ? "bg-accent font-medium" : ""}`}
                          ><PaymentBadge method={m} /></button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </TableHead>

                {/* Added By — filterable */}
                <TableHead>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                        Added By
                        <ListFilter className={`h-3.5 w-3.5 ${filterUser !== "all" ? "text-primary" : "text-muted-foreground"}`} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-44 p-2" align="start">
                      <div className="space-y-1">
                        <button
                          onClick={() => setFilterUser("all")}
                          className={`w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent ${filterUser === "all" ? "bg-accent font-medium" : ""}`}
                        >All Users</button>
                        {profiles.map((p) => (
                          <button
                            key={p.user_id}
                            onClick={() => setFilterUser(p.user_id)}
                            className={`w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent ${filterUser === p.user_id ? "bg-accent font-medium" : ""}`}
                          >{p.name}</button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </TableHead>

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
