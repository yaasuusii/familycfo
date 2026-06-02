import { useMemo } from "react";
import { Bell, ShieldAlert, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useBudgets, useExpenses, useCategories } from "@/hooks/useFinanceData";
import { useLoans } from "@/hooks/useLoanData";
import { getCurrentEthMonth, parseEthMonth } from "@/lib/ethiopian-calendar";
import { cn } from "@/lib/utils";

type Severity = "critical" | "warning";
interface Alert {
  severity: Severity;
  title: string;
  message: string;
}

export function NotificationsBell() {
  const { month, year } = parseEthMonth(getCurrentEthMonth());
  const { data: budgets = [] } = useBudgets(month, year);
  const { data: expenses = [] } = useExpenses(getCurrentEthMonth());
  const { data: categories = [] } = useCategories();
  const { data: loans = [] } = useLoans("active");

  const alerts = useMemo<Alert[]>(() => {
    const out: Alert[] = [];

    // Budget alerts per category
    const spentByCat: Record<string, number> = {};
    expenses.forEach((e: any) => {
      if (!e.category_id) return;
      spentByCat[e.category_id] = (spentByCat[e.category_id] || 0) + Number(e.amount);
    });
    budgets.forEach((b: any) => {
      const spent = spentByCat[b.category_id] || 0;
      const limit = Number(b.amount);
      if (!limit) return;
      const pct = (spent / limit) * 100;
      const catName = categories.find((c: any) => c.id === b.category_id)?.name || "Category";
      if (pct >= 100) {
        out.push({
          severity: "critical",
          title: `${catName} budget exceeded`,
          message: `Spent ${Math.round(pct)}% of this month's budget.`,
        });
      } else if (pct >= 90) {
        out.push({
          severity: "warning",
          title: `${catName} nearing limit`,
          message: `${Math.round(pct)}% of the budget used.`,
        });
      }
    });

    // Loan alerts
    const now = new Date();
    const soon = new Date();
    soon.setDate(soon.getDate() + 5);
    loans.forEach((l: any) => {
      if (!l.end_date) return;
      const due = new Date(l.end_date);
      if (due < now) {
        out.push({
          severity: "critical",
          title: `${l.counterparty || "Loan"} overdue`,
          message: `Due ${due.toLocaleDateString()}.`,
        });
      } else if (due <= soon) {
        out.push({
          severity: "warning",
          title: `${l.counterparty || "Loan"} due soon`,
          message: `Due ${due.toLocaleDateString()}.`,
        });
      }
    });

    return out;
  }, [budgets, expenses, categories, loans]);

  const hasCritical = alerts.some((a) => a.severity === "critical");
  const count = alerts.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notifications${count ? `, ${count} new` : ""}`}
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span
              className={cn(
                "absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white",
                hasCritical ? "bg-destructive" : "bg-warning",
              )}
            >
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-display text-sm font-semibold">Notifications</h3>
          {count > 0 && (
            <span className="text-xs text-muted-foreground">{count} active</span>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {count === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-success" />
              <p className="text-sm font-medium">You're all caught up</p>
              <p className="text-xs text-muted-foreground">No alerts right now.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {alerts.map((a, i) => {
                const Icon = a.severity === "critical" ? ShieldAlert : AlertTriangle;
                const tone =
                  a.severity === "critical"
                    ? "text-destructive"
                    : "text-warning";
                return (
                  <li key={i} className="flex items-start gap-3 px-4 py-3">
                    <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone)} />
                    <div className="min-w-0">
                      <p className={cn("text-sm font-medium", tone)}>{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.message}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
