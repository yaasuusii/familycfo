import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLoans(status?: string) {
  return useQuery({
    queryKey: ["loans", status],
    queryFn: async () => {
      let query = supabase.from("loans").select("*").order("created_at", { ascending: false });
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useLoan(id: string) {
  return useQuery({
    queryKey: ["loan", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("loans").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useLoanRepayments(loanId: string) {
  return useQuery({
    queryKey: ["loan_repayments", loanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_repayments")
        .select("*")
        .eq("loan_id", loanId)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!loanId,
  });
}

export function useCreateLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (loan: {
      loan_type: string;
      lender_or_borrower_name: string;
      principal_amount: number;
      interest_rate: number | null;
      total_amount_due: number;
      start_date: string;
      end_date: string | null;
      repayment_frequency: string;
      remaining_balance: number;
      created_by: string;
    }) => {
      const { error } = await supabase.from("loans").insert(loan);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loans"] }),
  });
}

export function useCreateRepayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (repayment: {
      loan_id: string;
      payment_date: string;
      amount_paid: number;
      remaining_balance: number;
      notes: string | null;
      created_by: string;
    }) => {
      const { error } = await supabase.from("loan_repayments").insert(repayment);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["loans"] });
      qc.invalidateQueries({ queryKey: ["loan", vars.loan_id] });
      qc.invalidateQueries({ queryKey: ["loan_repayments", vars.loan_id] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}

export function useActiveLoanSummary() {
  const { data: loans = [] } = useLoans("active");
  const taken = loans.filter((l) => l.loan_type === "taken");
  const given = loans.filter((l) => l.loan_type === "given");
  return {
    activeTakenCount: taken.length,
    activeGivenCount: given.length,
    totalDebt: taken.reduce((s, l) => s + Number(l.remaining_balance), 0),
    totalReceivable: given.reduce((s, l) => s + Number(l.remaining_balance), 0),
    loans,
  };
}
