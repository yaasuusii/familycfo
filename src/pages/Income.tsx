import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIncome, useProfiles, getCurrentMonth } from "@/hooks/useFinanceData";
import { formatETB } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, X, ListFilter, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeftRight } from "lucide-react";

const INCOME_SOURCES = ["Salary", "Business", "Other"] as const;
type IncomeSource = typeof INCOME_SOURCES[number];

const SOURCE_BADGE: Record<IncomeSource, string> = {
  Salary:   "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  Business: "bg-blue-100    text-blue-800    dark:bg-blue-900/40    dark:text-blue-300",
  Other:    "bg-gray-100    text-gray-800    dark:bg-gray-800/40    dark:text-gray-300",
};

function SourceBadge({ source }: { source: string }) {
  const cls = SOURCE_BADGE[source as IncomeSource] ?? "bg-secondary text-foreground";
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {source}
    </span>
  );
}

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

export default function Income() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const month = getCurrentMonth();
  const { data: income = [] } = useIncome(month);
  const { data: profiles = [] } = useProfiles();
  const [open, setOpen] = useState(false);
  const [filterSource, setFilterSource] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");
  const [sortAmount, setSortAmount] = useState<"none" | "asc" | "desc">("none");
  const [hideTransfers, setHideTransfers] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), source: "Salary", amount: "", payment_method: "127", notes: "", is_self_transfer: false });
  const [submitting, setSubmitting] = useState(false);

  const activeFilterCount = [filterSource, filterUser, filterPayment].filter((f) => f !== "all").length;

  const clearAllFilters = () => {
    setFilterSource("all");
    setFilterUser("all");
    setFilterPayment("all");
  };

  const filtered = income.filter((i) => {
    if (hideTransfers && i.is_self_transfer) return false;
    if (filterSource !== "all" && i.source !== filterSource) return false;
    if (filterUser !== "all" && i.user_id !== filterUser) return false;
    if (filterPayment !== "all" && i.payment_method !== filterPayment) return false;
    return true;
  });

  const sorted = sortAmount === "none" ? filtered : [...filtered].sort((a, b) =>
    sortAmount === "asc" ? Number(a.amount) - Number(b.amount) : Number(b.amount) - Number(a.amount)
  );

  const totalFiltered = filtered.reduce((s, i) => s + Number(i.amount), 0);
  const transferTotal = income.filter((i) => i.is_self_transfer).reduce((s, i) => s + Number(i.amount), 0);
  const hasTransfers = transferTotal > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("income").insert({
        user_id: user.id,
        date: form.date,
        source: form.source,
        amount: parseFloat(form.amount),
        payment_method: form.payment_method,
        notes: form.notes || null,
        is_self_transfer: form.is_self_transfer,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Income added");
      setOpen(false);
      setForm({ date: new Date().toISOString().slice(0, 10), source: "Salary", amount: "", payment_method: "127", notes: "", is_self_transfer: false });
      queryClient.invalidateQueries({ queryKey: ["income"] });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("income").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    queryClient.invalidateQueries({ queryKey: ["income"] });
  };

  const handleSourceChange = async (id: string, source: string) => {
    const { error } = await supabase.from("income").update({ source }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Source updated");
    queryClient.invalidateQueries({ queryKey: ["income"] });
  };

  const getUserName = (uid: string) => profiles.find((p) => p.user_id === uid)?.name ?? "Unknown";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Income</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Income</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Income</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INCOME_SOURCES.map((s) => (
                        <SelectItem key={s} value={s}>
                          <span className="flex items-center gap-2">
                            <SourceBadge source={s} />
                            {s === "Salary" && "Monthly salary"}
                            {s === "Business" && "Business income"}
                            {s === "Other" && "Other source"}
                          </span>
                        </SelectItem>
                      ))}
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
                  <Label>Account / Received Into</Label>
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
              <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/50">
                <Switch checked={form.is_self_transfer} onCheckedChange={(v) => setForm({ ...form, is_self_transfer: v })} />
                <div>
                  <Label className="text-sm font-medium">Self-transfer</Label>
                  <p className="text-xs text-muted-foreground">Internal transfer between your own accounts (e.g. received from own CBE/BOA)</p>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Saving…" : "Save"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Filtered by:</span>
          {filterSource !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1 font-normal">
              Source: <SourceBadge source={filterSource} />
              <button onClick={() => setFilterSource("all")} className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {filterPayment !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1 font-normal">
              Account: <PaymentBadge method={filterPayment} />
              <button onClick={() => setFilterPayment("all")} className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {filterUser !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1 font-normal">
              User: {getUserName(filterUser)}
              <button onClick={() => setFilterUser("all")} className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"><X className="h-3 w-3" /></button>
            </Badge>
          )}
          <button onClick={clearAllFilters} className="text-xs text-muted-foreground hover:text-foreground underline ml-1">Clear all</button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span>Total: {formatETB(totalFiltered)}</span>
                {hasTransfers && !hideTransfers && (
                  <span className="text-sm font-normal text-muted-foreground">
                    (Real: {formatETB(totalFiltered - filtered.filter(i => i.is_self_transfer).reduce((s, i) => s + Number(i.amount), 0))})
                  </span>
                )}
              </div>
              <span className="text-sm font-normal text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
                {activeFilterCount > 0 || hideTransfers ? ` (of ${income.length})` : ""}
              </span>
            </div>
            {hasTransfers && (
              <div className="flex items-center gap-2 text-sm font-normal">
                <Switch checked={hideTransfers} onCheckedChange={setHideTransfers} className="scale-75" />
                <span className="text-muted-foreground">
                  Hide self-transfers ({formatETB(transferTotal)})
                </span>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>

                {/* Source — filterable */}
                <TableHead>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                        Source
                        <ListFilter className={`h-3.5 w-3.5 ${filterSource !== "all" ? "text-primary" : "text-muted-foreground"}`} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-44 p-2" align="start">
                      <div className="space-y-1">
                        <button
                          onClick={() => setFilterSource("all")}
                          className={`w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent ${filterSource === "all" ? "bg-accent font-medium" : ""}`}
                        >All Sources</button>
                        {INCOME_SOURCES.map((s) => (
                          <button
                            key={s}
                            onClick={() => setFilterSource(s)}
                            className={`w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent flex items-center gap-2 ${filterSource === s ? "bg-accent font-medium" : ""}`}
                          ><SourceBadge source={s} /></button>
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
              {sorted.map((i) => (
                <TableRow key={i.id} className={i.is_self_transfer ? "opacity-60 bg-amber-50/50 dark:bg-amber-950/20" : ""}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {i.date}
                      {i.is_self_transfer && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          <ArrowLeftRight className="h-2.5 w-2.5" />Transfer
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {i.user_id === user?.id ? (
                      <Select value={i.source} onValueChange={(v) => handleSourceChange(i.id, v)}>
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {INCOME_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <SourceBadge source={i.source} />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{formatETB(Number(i.amount))}</TableCell>
                  <TableCell><PaymentBadge method={i.payment_method} /></TableCell>
                  <TableCell>{getUserName(i.user_id)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {i.notes && /^https?:\/\//.test(i.notes) ? (
                      <a href={i.notes} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">View Receipt</a>
                    ) : i.notes}
                  </TableCell>
                  <TableCell>
                    {i.user_id === user?.id && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(i.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No income recorded this month</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
