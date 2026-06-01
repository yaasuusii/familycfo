import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useExpenses, useCategories, useCategoryRules, useProfiles, getCurrentMonth } from "@/hooks/useFinanceData";
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
import { Plus, Trash2, X, ListFilter, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeftRight, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useCallback } from "react";

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
  const { data: expenses = [], isLoading: expensesLoading } = useExpenses(month);
  const { data: categories = [] } = useCategories();
  const { data: categoryRules = [] } = useCategoryRules();
  const { data: profiles = [] } = useProfiles();
  const [open, setOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");
  const [sortAmount, setSortAmount] = useState<"none" | "asc" | "desc">("none");
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), category: "Grocery", amount: "", payment_method: "CBE", notes: "", is_self_transfer: false });
  const [submitting, setSubmitting] = useState(false);
  const [hideTransfers, setHideTransfers] = useState(false);
  const [categorySuggestion, setCategorySuggestion] = useState<string | null>(null);
  const [fetchingReceipt, setFetchingReceipt] = useState(false);

  // Auto-suggest category from receipt URL or notes text
  const suggestCategoryFromNotes = useCallback(async (notes: string) => {
    if (!notes || categoryRules.length === 0) {
      setCategorySuggestion(null);
      return;
    }

    // 1. Check keyword rules against notes text (for manual notes like "suk" or "lunch")
    const notesLower = notes.toLowerCase();
    const keywordRules = categoryRules.filter(r => r.match_type === 'keyword' || !r.match_type);
    // Sort by keyword length desc so "home paper" matches before "home"
    const sorted = [...keywordRules].sort((a, b) => b.keyword.length - a.keyword.length);
    for (const rule of sorted) {
      if (notesLower.includes(rule.keyword.toLowerCase())) {
        setCategorySuggestion(rule.category);
        return;
      }
    }

    // 2. If it's a Telebirr receipt URL, fetch and check recipient
    if (notes.includes('transactioninfo.ethiotelecom.et/receipt/')) {
      setFetchingReceipt(true);
      try {
        const res = await fetch(notes);
        const html = await res.text();

        // Extract recipient name
        let recipient = '';
        // Pattern: "Credited Party name" then next td contains the name
        const m1 = html.match(/Credited [Pp]arty.*?<label[^>]*>(.*?)<\/label>/s);
        if (m1) {
          recipient = m1[1].trim();
        } else {
          const m2 = html.match(/Credited Party name\s*<\/td>\s*<td[^>]*>(.*?)<\/td>/s);
          if (m2) {
            recipient = m2[1].replace(/<[^>]+>/g, '').trim();
          }
        }

        // Extract payment reason
        let reason = '';
        const m3 = html.match(/Payment Reason[^<]*(?:<\/td>)?\s*(?:<td[^>]*>)?\s*(.*?)(?:<\/td>|<br|\n)/si);
        if (m3) {
          reason = m3[1].replace(/<[^>]+>/g, '').trim();
        }

        // Check recipient against rules
        if (recipient) {
          const recipientRules = categoryRules.filter(r => r.match_type === 'recipient');
          for (const rule of recipientRules) {
            if (rule.keyword.toLowerCase() === recipient.toLowerCase()) {
              setCategorySuggestion(rule.category);
              setFetchingReceipt(false);
              return;
            }
          }
        }

        // Check reason against keyword rules
        if (reason) {
          const reasonLower = reason.toLowerCase();
          for (const rule of sorted) {
            if (reasonLower.includes(rule.keyword.toLowerCase())) {
              setCategorySuggestion(rule.category);
              setFetchingReceipt(false);
              return;
            }
          }
        }

        // Reason-based fallback for known telebirr reasons
        if (reason.includes('Buy Goods')) {
          setCategorySuggestion('Shopping');
        } else if (reason.includes('Airtime') || reason.includes('Telecom') || reason.includes('CRM Buy Package')) {
          setCategorySuggestion('Utilities');
        } else if (reason.includes('Customer Transfer from Mobile Money to Bank')) {
          setCategorySuggestion('Transfer');
        }
      } catch {
        // Receipt fetch failed - no suggestion
      } finally {
        setFetchingReceipt(false);
      }
      return;
    }

    setCategorySuggestion(null);
  }, [categoryRules]);

  // Trigger auto-suggest when notes change (with debounce for URL fetching)
  useEffect(() => {
    const isUrl = form.notes.startsWith('http');
    const delay = isUrl ? 500 : 100;  // Debounce URL fetches
    const timer = setTimeout(() => suggestCategoryFromNotes(form.notes), delay);
    return () => clearTimeout(timer);
  }, [form.notes, suggestCategoryFromNotes]);

  const activeFilterCount = [filterCategory, filterUser, filterPayment].filter((f) => f !== "all").length;

  const clearAllFilters = () => {
    setFilterCategory("all");
    setFilterUser("all");
    setFilterPayment("all");
  };

  const filtered = expenses.filter((e) => {
    if (hideTransfers && e.is_self_transfer) return false;
    if (filterCategory !== "all" && e.category !== filterCategory) return false;
    if (filterUser !== "all" && e.user_id !== filterUser) return false;
    if (filterPayment !== "all" && e.payment_method !== filterPayment) return false;
    return true;
  });

  const transferTotal = expenses.filter((e) => e.is_self_transfer).reduce((s, e) => s + Number(e.amount), 0);
  const hasTransfers = transferTotal > 0;

  const sorted = sortAmount === "none" ? filtered : [...filtered].sort((a, b) =>
    sortAmount === "asc" ? Number(a.amount) - Number(b.amount) : Number(b.amount) - Number(a.amount)
  );

  const totalFiltered = filtered.reduce((s, e) => s + Number(e.amount), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || submitting) return;
    setSubmitting(true);
    try {
      const { data: inserted, error } = await supabase.from("expenses").insert({
        user_id: user.id,
        date: form.date,
        category: form.category,
        amount: parseFloat(form.amount),
        payment_method: form.payment_method,
        notes: form.notes || null,
        is_self_transfer: form.is_self_transfer,
      }).select("id, notes, category").single();
      if (error) { toast.error(error.message); return; }
      toast.success("Expense added");
      setOpen(false);
      setForm({ date: new Date().toISOString().slice(0, 10), category: "Grocery", amount: "", payment_method: "CBE", notes: "", is_self_transfer: false });
      setCategorySuggestion(null);
      queryClient.invalidateQueries({ queryKey: ["expenses"] });

      // Auto-categorize via Edge Function if category is "Other" and has receipt URL
      if (inserted && inserted.category === "Other" && inserted.notes?.startsWith("http")) {
        supabase.functions.invoke("auto-categorize", {
          body: { expense_id: inserted.id },
        }).then(({ data }) => {
          if (data?.updated > 0) {
            const newCat = data.results?.[0]?.category;
            toast.success(`Auto-categorized as ${newCat}`, { icon: "✨" });
            queryClient.invalidateQueries({ queryKey: ["expenses"] });
          }
        }).catch(() => { /* silent — manual category still works */ });
      }
    } finally {
      setSubmitting(false);
    }
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

  if (expensesLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="hidden h-10 w-32 md:block" />
        </div>
        <Card>
          <CardContent className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Expenses</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="hidden md:inline-flex"><Plus className="mr-2 h-4 w-4" />Add Expense</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
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
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Paste receipt URL or add notes (e.g. suk, lunch, pharmacy)" />
                {fetchingReceipt && (
                  <p className="text-xs text-muted-foreground animate-pulse flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Reading receipt…
                  </p>
                )}
                {categorySuggestion && !fetchingReceipt && categorySuggestion !== form.category && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...form, category: categorySuggestion });
                      setCategorySuggestion(null);
                      toast.success(`Category set to ${categorySuggestion}`);
                    }}
                    className="flex items-center gap-1.5 rounded-md bg-violet-50 border border-violet-200 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors dark:bg-violet-950/30 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/50"
                  >
                    <Sparkles className="h-3 w-3" />
                    Suggest: {categorySuggestion} — click to apply
                  </button>
                )}
              </div>
              <div className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                form.is_self_transfer
                  ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
                  : (form.payment_method === "CBE" || form.payment_method === "BOA")
                    ? "bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800"
                    : "bg-muted/50"
              }`}>
                <Switch checked={form.is_self_transfer} onCheckedChange={(v) => setForm({ ...form, is_self_transfer: v })} />
                <div>
                  <Label className="text-sm font-medium">Self-transfer</Label>
                  <p className="text-xs text-muted-foreground">
                    {form.is_self_transfer
                      ? "This will be excluded from real expense totals"
                      : (form.payment_method === "CBE" || form.payment_method === "BOA")
                        ? "Is this a transfer to your Telebirr (127)? Turn this on."
                        : "Internal transfer between your own accounts (e.g. CBE/BOA to Telebirr)"}
                  </p>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Saving…" : "Save"}</Button>
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

      {/* Mobile filter bar */}
      <div className="grid grid-cols-2 gap-2 md:hidden">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="h-10"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPayment} onValueChange={setFilterPayment}>
          <SelectTrigger className="h-10"><SelectValue placeholder="Account" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterUser} onValueChange={setFilterUser}>
          <SelectTrigger className="h-10"><SelectValue placeholder="Added by" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortAmount} onValueChange={(v) => setSortAmount(v as "none" | "asc" | "desc")}>
          <SelectTrigger className="h-10"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sort: Newest</SelectItem>
            <SelectItem value="desc">Amount: High to Low</SelectItem>
            <SelectItem value="asc">Amount: Low to High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span>Total: {formatETB(totalFiltered)}</span>
                {hasTransfers && !hideTransfers && (
                  <span className="text-sm font-normal text-muted-foreground">
                    (Real: {formatETB(totalFiltered - filtered.filter(e => e.is_self_transfer).reduce((s, e) => s + Number(e.amount), 0))})
                  </span>
                )}
              </div>
              <span className="text-sm font-normal text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
                {activeFilterCount > 0 || hideTransfers ? ` (of ${expenses.length})` : ""}
              </span>
            </div>
            {hasTransfers && (
              <label className="flex cursor-pointer items-center gap-2 py-1 text-sm font-normal">
                <Switch checked={hideTransfers} onCheckedChange={setHideTransfers} />
                <span className="text-muted-foreground">
                  Hide self-transfers ({formatETB(transferTotal)})
                </span>
              </label>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mobile card list */}
          <div className="space-y-2 md:hidden">
            {sorted.map((e) => (
              <div
                key={e.id}
                className={`rounded-lg border p-3 ${e.is_self_transfer ? "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20" : "bg-card"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {e.user_id === user?.id ? (
                      <Select value={e.category} onValueChange={(v) => handleCategoryChange(e.id, v)}>
                        <SelectTrigger className="h-9 w-full max-w-[12rem] text-sm font-medium"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm font-medium">{e.category}</span>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>{e.date}</span>
                      <PaymentBadge method={e.payment_method} />
                      <span>· {getUserName(e.user_id)}</span>
                      {e.is_self_transfer && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          <ArrowLeftRight className="h-2.5 w-2.5" />Transfer
                        </span>
                      )}
                    </div>
                    {e.notes && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {/^https?:\/\//.test(e.notes) ? (
                          <a href={e.notes} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">View Receipt</a>
                        ) : <span className="line-clamp-2">{e.notes}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-semibold">{formatETB(Number(e.amount))}</span>
                    {e.user_id === user?.id && (
                      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleDelete(e.id)} aria-label="Delete expense">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No expenses found</p>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
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

                {/* Amount — sortable */}
                <TableHead>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                        Amount
                        {sortAmount === "none" && <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}
                        {sortAmount === "asc" && <ArrowUp className="h-3.5 w-3.5 text-primary" />}
                        {sortAmount === "desc" && <ArrowDown className="h-3.5 w-3.5 text-primary" />}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-44 p-2" align="start">
                      <div className="space-y-1">
                        <button
                          onClick={() => setSortAmount("none")}
                          className={`w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent flex items-center gap-2 ${sortAmount === "none" ? "bg-accent font-medium" : ""}`}
                        ><ArrowUpDown className="h-3.5 w-3.5" /> Default</button>
                        <button
                          onClick={() => setSortAmount("asc")}
                          className={`w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent flex items-center gap-2 ${sortAmount === "asc" ? "bg-accent font-medium" : ""}`}
                        ><ArrowUp className="h-3.5 w-3.5" /> Low to High</button>
                        <button
                          onClick={() => setSortAmount("desc")}
                          className={`w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent flex items-center gap-2 ${sortAmount === "desc" ? "bg-accent font-medium" : ""}`}
                        ><ArrowDown className="h-3.5 w-3.5" /> High to Low</button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </TableHead>

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
              {sorted.map((e) => (
                <TableRow key={e.id} className={e.is_self_transfer ? "opacity-60 bg-amber-50/50 dark:bg-amber-950/20" : ""}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {e.date}
                      {e.is_self_transfer && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          <ArrowLeftRight className="h-2.5 w-2.5" />Transfer
                        </span>
                      )}
                    </div>
                  </TableCell>
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
                  <TableCell className="text-muted-foreground text-sm">
                    {e.notes && /^https?:\/\//.test(e.notes) ? (
                      <a href={e.notes} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">View Receipt</a>
                    ) : e.notes}
                  </TableCell>
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
          </div>
        </CardContent>
      </Card>

      {/* Mobile floating action button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Add expense"
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95 md:hidden"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
