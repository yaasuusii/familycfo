import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLoan, useLoanRepayments, useCreateRepayment } from "@/hooks/useLoanData";
import { formatETB, formatPercent } from "@/lib/format";
import { Money } from "@/components/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Plus } from "lucide-react";

export default function LoanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { data: loan, isLoading } = useLoan(id!);
  const { data: repayments = [] } = useLoanRepayments(id!);
  const createRepayment = useCreateRepayment();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ payment_date: new Date().toISOString().slice(0, 10), amount_paid: "", notes: "" });

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!loan) return <div className="py-20 text-center text-muted-foreground">Loan not found</div>;

  const totalDue = Number(loan.total_amount_due);
  const remaining = Number(loan.remaining_balance);
  const paid = totalDue - remaining;
  const paidPct = totalDue > 0 ? (paid / totalDue) * 100 : 0;
  const principal = Number(loan.principal_amount);
  const interestPortion = totalDue - principal;
  const isOverdue = loan.end_date && loan.status === "active" && new Date(loan.end_date) < new Date();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await createRepayment.mutateAsync({
        loan_id: loan.id,
        payment_date: form.payment_date,
        amount_paid: parseFloat(form.amount_paid),
        remaining_balance: 0, // trigger will calculate
        notes: form.notes || null,
        created_by: user.id,
      });
      toast.success("Payment recorded");
      setOpen(false);
      setForm({ payment_date: new Date().toISOString().slice(0, 10), amount_paid: "", notes: "" });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/loans")}><ArrowLeft className="h-4 w-4" /></Button>
        <h2 className="font-display text-2xl font-semibold tracking-tight">{loan.lender_or_borrower_name}</h2>
        <Badge variant={loan.status === "active" ? (isOverdue ? "destructive" : "default") : "secondary"}>
          {isOverdue ? "Overdue" : loan.status}
        </Badge>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card-soft lift p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Principal</p><Money amount={principal} className="mt-1 block text-lg text-foreground" /></div>
        <div className="card-soft lift p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Interest ({loan.interest_rate ? `${loan.interest_rate}%` : "0%"})</p><Money amount={interestPortion} className="mt-1 block text-lg text-foreground" /></div>
        <div className="card-soft lift p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Total Due</p><Money amount={totalDue} className="mt-1 block text-lg text-foreground" /></div>
        <div className="card-soft lift p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Remaining</p><Money amount={remaining} className={`mt-1 block text-lg ${remaining > 0 ? "text-destructive" : "text-success"}`} /></div>
      </div>

      {/* Progress */}
      <Card>
        <CardHeader><CardTitle className="text-base">Repayment Progress</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Paid: {formatETB(paid)}</span>
            <span className="font-medium">{formatPercent(paidPct)}</span>
          </div>
          <Progress value={Math.min(paidPct, 100)} className="h-3" />
        </CardContent>
      </Card>

      {/* Interest Breakdown */}
      {interestPortion > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Interest Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><p className="text-xs text-muted-foreground">Principal</p><p className="font-medium">{formatETB(principal)} ({formatPercent((principal / totalDue) * 100)})</p></div>
              <div><p className="text-xs text-muted-foreground">Interest</p><p className="font-medium">{formatETB(interestPortion)} ({formatPercent((interestPortion / totalDue) * 100)})</p></div>
              <div><p className="text-xs text-muted-foreground">Rate</p><p className="font-medium">{loan.interest_rate}%</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loan Details */}
      <Card>
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div><p className="text-muted-foreground">Type</p><p className="font-medium capitalize">{loan.loan_type === "taken" ? "Loan Taken (Liability)" : "Loan Given (Asset)"}</p></div>
            <div><p className="text-muted-foreground">Start Date</p><p className="font-medium">{loan.start_date}</p></div>
            <div><p className="text-muted-foreground">End Date</p><p className="font-medium">{loan.end_date || "—"}</p></div>
            <div><p className="text-muted-foreground">Frequency</p><p className="font-medium capitalize">{loan.repayment_frequency}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Payment History</CardTitle>
          {role === "admin" && loan.status === "active" && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" />Record Payment</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Payment Date</Label>
                      <Input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Amount (ETB)</Label>
                      <Input type="number" step="0.01" min="0.01" max={remaining} value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: e.target.value })} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </div>
                  <Button type="submit" className="w-full" disabled={createRepayment.isPending}>
                    {createRepayment.isPending ? "Recording..." : "Record Payment"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Balance After</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repayments.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.payment_date}</TableCell>
                  <TableCell className="font-medium">{formatETB(Number(r.amount_paid))}</TableCell>
                  <TableCell>{formatETB(Number(r.remaining_balance))}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{r.notes}</TableCell>
                </TableRow>
              ))}
              {repayments.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No payments recorded yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Timeline */}
      {repayments.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Payment Timeline</CardTitle></CardHeader>
          <CardContent>
            <div className="relative ml-4 space-y-4 border-l-2 border-muted pl-6">
              <div className="relative">
                <div className="absolute -left-[31px] h-3 w-3 rounded-full bg-primary" />
                <p className="text-sm font-medium">Loan Started</p>
                <p className="text-xs text-muted-foreground">{loan.start_date} — {formatETB(totalDue)}</p>
              </div>
              {[...repayments].reverse().map((r) => (
                <div key={r.id} className="relative">
                  <div className="absolute -left-[31px] h-3 w-3 rounded-full bg-success" />
                  <p className="text-sm font-medium">Payment: {formatETB(Number(r.amount_paid))}</p>
                  <p className="text-xs text-muted-foreground">{r.payment_date} — Balance: {formatETB(Number(r.remaining_balance))}</p>
                </div>
              ))}
              {loan.status === "closed" && (
                <div className="relative">
                  <div className="absolute -left-[31px] h-3 w-3 rounded-full bg-success" />
                  <p className="text-sm font-medium text-success">Loan Closed</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
