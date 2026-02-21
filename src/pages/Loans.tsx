import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLoans, useCreateLoan } from "@/hooks/useLoanData";
import { formatETB } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, AlertTriangle, ShieldAlert } from "lucide-react";

function isOverdue(loan: { end_date: string | null; status: string }) {
  if (!loan.end_date || loan.status === "closed") return false;
  return new Date(loan.end_date) < new Date();
}

function isDueSoon(loan: { end_date: string | null; status: string }) {
  if (!loan.end_date || loan.status === "closed") return false;
  const diff = (new Date(loan.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return diff > 0 && diff <= 5;
}

export default function Loans() {
  const { user, role } = useAuth();
  const { data: loans = [] } = useLoans();
  const createLoan = useCreateLoan();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    loan_type: "taken",
    lender_or_borrower_name: "",
    principal_amount: "",
    interest_rate: "",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
    repayment_frequency: "monthly",
  });

  const takenLoans = useMemo(() => loans.filter((l) => l.loan_type === "taken"), [loans]);
  const givenLoans = useMemo(() => loans.filter((l) => l.loan_type === "given"), [loans]);

  const hasOverdue = loans.some(isOverdue);
  const hasDueSoon = loans.some(isDueSoon);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const principal = parseFloat(form.principal_amount);
    const rate = form.interest_rate ? parseFloat(form.interest_rate) : null;
    const totalDue = rate ? principal * (1 + rate / 100) : principal;

    try {
      await createLoan.mutateAsync({
        loan_type: form.loan_type,
        lender_or_borrower_name: form.lender_or_borrower_name,
        principal_amount: principal,
        interest_rate: rate,
        total_amount_due: totalDue,
        start_date: form.start_date,
        end_date: form.end_date || null,
        repayment_frequency: form.repayment_frequency,
        remaining_balance: totalDue,
        created_by: user.id,
      });
      toast.success("Loan created");
      setOpen(false);
      setForm({ loan_type: "taken", lender_or_borrower_name: "", principal_amount: "", interest_rate: "", start_date: new Date().toISOString().slice(0, 10), end_date: "", repayment_frequency: "monthly" });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const LoanTable = ({ items }: { items: typeof loans }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{items[0]?.loan_type === "taken" ? "Lender" : "Borrower"}</TableHead>
          <TableHead>Principal</TableHead>
          <TableHead>Total Due</TableHead>
          <TableHead>Remaining</TableHead>
          <TableHead>End Date</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((l) => (
          <TableRow
            key={l.id}
            className={`cursor-pointer hover:bg-muted/50 ${isOverdue(l) ? "bg-destructive/10" : ""}`}
            onClick={() => navigate(`/loans/${l.id}`)}
          >
            <TableCell className="font-medium">{l.lender_or_borrower_name}</TableCell>
            <TableCell>{formatETB(Number(l.principal_amount))}</TableCell>
            <TableCell>{formatETB(Number(l.total_amount_due))}</TableCell>
            <TableCell>{formatETB(Number(l.remaining_balance))}</TableCell>
            <TableCell>{l.end_date || "—"}</TableCell>
            <TableCell>
              <Badge variant={l.status === "active" ? (isOverdue(l) ? "destructive" : "default") : "secondary"}>
                {isOverdue(l) ? "Overdue" : l.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
        {items.length === 0 && (
          <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No loans found</TableCell></TableRow>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      {hasOverdue && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>One or more loans are overdue!</AlertDescription>
        </Alert>
      )}
      {!hasOverdue && hasDueSoon && (
        <Alert className="border-warning/50 text-warning [&>svg]:text-warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>One or more loans have payments due within 5 days.</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Loans</h2>
        {role === "admin" && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Add Loan</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Loan</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Loan Type</Label>
                  <Select value={form.loan_type} onValueChange={(v) => setForm({ ...form, loan_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="taken">Loan Taken (Liability)</SelectItem>
                      <SelectItem value="given">Loan Given (Asset)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{form.loan_type === "taken" ? "Lender Name" : "Borrower Name"}</Label>
                  <Input value={form.lender_or_borrower_name} onChange={(e) => setForm({ ...form, lender_or_borrower_name: e.target.value })} required />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Principal Amount (ETB)</Label>
                    <Input type="number" step="0.01" min="0.01" value={form.principal_amount} onChange={(e) => setForm({ ...form, principal_amount: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Interest Rate (%)</Label>
                    <Input type="number" step="0.01" min="0" value={form.interest_rate} onChange={(e) => setForm({ ...form, interest_rate: e.target.value })} placeholder="Optional" />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Repayment Frequency</Label>
                  <Select value={form.repayment_frequency} onValueChange={(v) => setForm({ ...form, repayment_frequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={createLoan.isPending}>
                  {createLoan.isPending ? "Creating..." : "Create Loan"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="taken">
        <TabsList>
          <TabsTrigger value="taken">Loans Taken ({takenLoans.length})</TabsTrigger>
          <TabsTrigger value="given">Loans Given ({givenLoans.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="taken">
          <Card>
            <CardHeader><CardTitle className="text-base">Liabilities</CardTitle></CardHeader>
            <CardContent><LoanTable items={takenLoans} /></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="given">
          <Card>
            <CardHeader><CardTitle className="text-base">Receivables</CardTitle></CardHeader>
            <CardContent><LoanTable items={givenLoans} /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
