import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Money,
  StatHeroCard,
  RadialGauge,
  DonutStat,
  TrendArea,
  ListRow,
  Reveal,
  SectionHeader,
  Panel,
  type HeroState,
} from "@/components/finance";
import { useIncome, useExpenses, useBudgets } from "@/hooks/useFinanceData";
import { getFinancialPeriod, shiftPeriod } from "@/lib/finance-period";
import { incomeBreakdown, expenseBreakdown, realExpenses } from "@/lib/finance-calc";
import { loadHouseholdSize } from "@/lib/household";
import { useLoans } from "@/hooks/useLoanData";
import { useUpcomingRecurring } from "@/hooks/useRecurringData";
import { useMealPlan, useMeals, usePregnancyProfile, getTrimester, getWeekStart, MEAL_TYPES, NUTRIENTS } from "@/hooks/useMealData";
import { formatETB, formatPercent } from "@/lib/format";
import { getCurrentEthiopianMonth, getCurrentEthMonth, getEthiopianMonthName, getEthiopianDaysInMonth } from "@/lib/ethiopian-calendar";
import {
  TrendingUp, TrendingDown, Wallet, ShoppingCart, PiggyBank, Target,
  AlertTriangle, Landmark, HandCoins, Scale, RefreshCw,
  UtensilsCrossed, Baby, ChevronRight, ArrowUpRight,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, typeof ShoppingCart> = {
  Grocery: ShoppingCart,
  "Loan Repayment": Landmark,
};

export default function Dashboard() {
  const period = useMemo(() => getFinancialPeriod(), []);
  const householdSize = useMemo(() => loadHouseholdSize(), []);
  const eth = getCurrentEthiopianMonth();
  const isMobile = useIsMobile();

  const prevPeriod = useMemo(() => shiftPeriod(period, 1), [period]);

  const { data: income = [], isLoading: incomeLoading } = useIncome(period);
  const { data: expenses = [], isLoading: expensesLoading } = useExpenses(period);
  const { data: prevIncome = [] } = useIncome(prevPeriod);
  const { data: prevExpenses = [] } = useExpenses(prevPeriod);
  const { data: budgets = [] } = useBudgets(eth.month, eth.year);
  // Budget widget tracks the Ethiopian month (same window as Budgets page) so "spent" agrees.
  const ethMonthStr = useMemo(() => getCurrentEthMonth(), []);
  const { data: budgetExpenses = [] } = useExpenses(ethMonthStr);
  const { data: allLoans = [] } = useLoans();
  const upcomingItems = useUpcomingRecurring();

  // Meal planner data
  const weekStart = getWeekStart(new Date());
  const { data: mealPlan } = useMealPlan(weekStart);
  const { data: allMeals = [] } = useMeals(mealPlan?.id);
  const { data: pregnancyProfile } = usePregnancyProfile();
  const trimesterInfo = pregnancyProfile?.due_date ? getTrimester(pregnancyProfile.due_date) : null;

  const todayDow = (new Date().getDay() + 6) % 7; // 0=Mon
  const todayMeals = useMemo(() => allMeals.filter((m: any) => m.day_of_week === todayDow), [allMeals, todayDow]);
  const todayNutrients = useMemo(() => {
    const covered = new Set<string>();
    todayMeals.forEach((m: any) => m.meal_nutrition?.forEach((n: any) => covered.add(n.nutrient)));
    return covered;
  }, [todayMeals]);

  const activeLoans = useMemo(() => allLoans.filter((l) => l.status === "active"), [allLoans]);
  const activeTaken = useMemo(() => activeLoans.filter((l) => l.loan_type === "taken"), [activeLoans]);
  const activeGiven = useMemo(() => activeLoans.filter((l) => l.loan_type === "given"), [activeLoans]);
  const totalDebt = activeTaken.reduce((s, l) => s + Number(l.remaining_balance), 0);
  const totalReceivable = activeGiven.reduce((s, l) => s + Number(l.remaining_balance), 0);

  // Real totals exclude self-transfers and loan movements (loans tracked separately).
  const incBd = useMemo(() => incomeBreakdown(income), [income]);
  const expBd = useMemo(() => expenseBreakdown(expenses), [expenses]);
  const totalIncome = incBd.real;
  const totalExpenses = expBd.real;
  const remaining = totalIncome - totalExpenses;
  const grocerySpend = useMemo(() => expenses.filter((e) => e.category === "Grocery").reduce((s, e) => s + Number(e.amount), 0), [expenses]);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  // Month-over-month deltas (vs previous pay-cycle period)
  const prevIncomeTotal = useMemo(() => incomeBreakdown(prevIncome).real, [prevIncome]);
  const prevExpenseTotal = useMemo(() => expenseBreakdown(prevExpenses).real, [prevExpenses]);
  const pctDelta = (cur: number, prev: number): number | null =>
    prev > 0 ? ((cur - prev) / prev) * 100 : null;
  const incomeDelta = pctDelta(totalIncome, prevIncomeTotal);
  const expenseDelta = pctDelta(totalExpenses, prevExpenseTotal);

  const loanRepaymentThisMonth = expBd.loans;
  const debtToIncomeRatio = totalIncome > 0 ? (loanRepaymentThisMonth / totalIncome) * 100 : 0;

  const budgetStats = useMemo(() => {
    return budgets.map((b) => {
      const actual = budgetExpenses.filter((e) => e.category === b.category).reduce((s, e) => s + Number(e.amount), 0);
      const limit = Number(b.monthly_limit);
      const pct = limit > 0 ? (actual / limit) * 100 : 0;
      return { category: b.category, limit, actual, pct, remaining: limit - actual };
    });
  }, [budgets, budgetExpenses]);

  const totalBudget = budgetStats.reduce((s, b) => s + b.limit, 0);
  const totalBudgetSpent = budgetStats.reduce((s, b) => s + b.actual, 0);
  const overallBudgetPct = totalBudget > 0 ? (totalBudgetSpent / totalBudget) * 100 : 0;
  const anyExceeded = budgetStats.some((b) => b.pct >= 100);
  const overallWarning = overallBudgetPct > 90;

  const remainingReserved = budgetStats
    .filter((b) => b.pct < 100)
    .reduce((s, b) => s + Math.max(b.remaining, 0), 0);
  const safeToSpend = totalIncome - totalExpenses - remainingReserved;

  const dailyTrend = useMemo(() => {
    const map: Record<string, number> = {};
    realExpenses(expenses).forEach((e) => { map[e.date] = (map[e.date] || 0) + Number(e.amount); });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date: date.slice(5), amount }));
  }, [expenses]);

  const recentExpenses = useMemo(
    () => [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
    [expenses]
  );

  const dayOfMonth = eth.day;
  const daysInMonth = getEthiopianDaysInMonth(eth.month, eth.year);
  const projectedExpenses = dayOfMonth > 0 ? (totalExpenses / dayOfMonth) * daysInMonth : 0;
  const projectedRemaining = totalIncome - projectedExpenses;

  const ethMonthLabel = `${getEthiopianMonthName(eth.month)} ${eth.year}`;

  // Status of the two hero panels
  const spendState: HeroState = safeToSpend < 0 ? "bad" : safeToSpend < totalIncome * 0.1 ? "warn" : "good";
  const budgetState: HeroState = anyExceeded ? "bad" : overallWarning ? "warn" : "good";

  if (incomeLoading || expensesLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* ── Masthead ── */}

      <Reveal index={0}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Family CFO
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
              Overview
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {ethMonthLabel} · Day {dayOfMonth} of {daysInMonth}
            </p>
          </div>
        </div>
      </Reveal>

      {/* ── Signature hero pair ── */}
      <Reveal index={2}>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatHeroCard
            state={spendState}
            label="Safe to Spend"
            amount={safeToSpend}
            icon={Wallet}
            subtitle="Income − spent − reserved budget"
          />
          <StatHeroCard
            state={budgetState}
            label="Budget Health"
            value={formatPercent(overallBudgetPct)}
            icon={Target}
            subtitle={`${formatETB(totalBudgetSpent)} of ${formatETB(totalBudget)} used`}
            footer={
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/25">
                <div className="h-full rounded-full bg-white/90" style={{ width: `${Math.min(overallBudgetPct, 100)}%` }} />
              </div>
            }
          />
        </div>
      </Reveal>

      {/* ── Accent stat strip ── */}
      <Reveal index={3}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Income" amount={totalIncome} icon={TrendingUp} tint="hsl(var(--success))" deltaPct={incomeDelta} goodWhenUp />
          <MiniStat label="Expenses" amount={totalExpenses} icon={TrendingDown} tint="hsl(var(--destructive))" deltaPct={expenseDelta} goodWhenUp={false} />
          <MiniStat label="Remaining" amount={remaining} icon={PiggyBank} tint="hsl(var(--primary))" />
          <MiniStat label="Projected" amount={projectedRemaining} icon={Target} tint="hsl(var(--info))" />
        </div>
      </Reveal>

      {/* ── Pending reimbursement callout ── */}
      {expBd.pendingReimbursable > 0 && (
        <Reveal index={3}>
          <Link to="/expenses" className="block">
            <Card className="card-soft lift border-0">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                     style={{ background: "color-mix(in oklab, hsl(var(--info)) 14%, transparent)" }}>
                  <HandCoins className="h-5 w-5" style={{ color: "hsl(var(--info))" }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">Awaiting reimbursement</p>
                  <p className="text-xs text-muted-foreground">Out-of-pocket spend not yet paid back</p>
                </div>
                <Money amount={expBd.pendingReimbursable} className="text-base font-semibold text-[hsl(var(--info))]" />
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        </Reveal>
      )}

      {/* ── Today's Meals (upper — checked daily) ── */}
      <Reveal index={4}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel>
            <div className="flex items-start justify-between">
              <SectionHeader title="Today's Meals" caption={trimesterInfo ? `Trimester ${trimesterInfo.trimester} · Week ${trimesterInfo.weeksPregnant}` : "Planned for today"} />
              <Link to="/meal-planner" className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
                Planner <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            {trimesterInfo && (
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Baby className="h-3 w-3 text-primary" /> Pregnancy nutrition tracking on
              </p>
            )}
            <div className="mt-3 space-y-1.5">
              {todayMeals.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">
                  No meals planned. <Link to="/meal-planner" className="text-primary hover:underline">Plan now</Link>
                </p>
              ) : (
                MEAL_TYPES.map((slot) => {
                  const meal = todayMeals.find((m: any) => m.meal_type === slot.key);
                  return (
                    <div key={slot.key} className="flex items-center justify-between border-b py-1.5 text-sm last:border-0">
                      <span className="w-16 text-xs uppercase tracking-wide text-muted-foreground">{slot.short}</span>
                      <span className={`flex-1 ${meal ? "font-medium text-foreground" : "italic text-muted-foreground"}`}>
                        {meal ? meal.name : "—"}
                      </span>
                      {meal?.estimated_cost && <Money amount={Number(meal.estimated_cost)} hideCents className="text-xs text-muted-foreground" />}
                    </div>
                  );
                })
              )}
            </div>
            {todayMeals.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {NUTRIENTS.map((n) => (
                  <Badge
                    key={n.key}
                    variant={todayNutrients.has(n.key) ? "default" : "outline"}
                    className={`px-1.5 py-0 text-[10px] ${todayNutrients.has(n.key) ? "bg-success text-success-foreground" : "opacity-50"}`}
                  >
                    {n.emoji} {n.label}
                  </Badge>
                ))}
              </div>
            )}
          </Panel>

          <Panel>
            <SectionHeader title="This Week's Plan" caption="Meal coverage" className="mb-3" />
            {allMeals.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                No meal plan yet. <Link to="/meal-planner" className="text-primary hover:underline">Generate one</Link>
              </p>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">Meals planned</span>
                    <span className="tnum font-medium text-foreground">{allMeals.length}/35</span>
                  </div>
                  <Progress value={(allMeals.length / 35) * 100} className="h-2" />
                </div>
                <Row label="Est. weekly cost" value={<Money amount={allMeals.reduce((s: number, m: any) => s + Number(m.estimated_cost || 0), 0) * householdSize} className="text-sm" />} />
                <Row label="Nutrition today" value={<span className="tnum font-medium">{todayNutrients.size}/{NUTRIENTS.length}</span>} />
              </div>
            )}
          </Panel>
        </div>
      </Reveal>

      {/* ── Budget ring + cash flow ── */}
      {budgetStats.length > 0 && (
        <Reveal index={5}>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel className="flex items-center gap-5">
              <RadialGauge value={overallBudgetPct} caption="used" />
              <div className="min-w-0 space-y-2">
                <SectionHeader title="Budget" caption={ethMonthLabel} />
                <Row label="Allocated" value={<Money amount={totalBudget} className="text-sm" />} />
                <Row label="Spent" value={<Money amount={totalBudgetSpent} className="text-sm" />} />
                <Row label="Remaining" value={<Money amount={totalBudget - totalBudgetSpent} className="text-sm" />} />
              </div>
            </Panel>
            <Panel>
              <SectionHeader title="Cash Flow" caption="Saved vs spent" className="mb-3" />
              <DonutStat
                size={isMobile ? 160 : 170}
                thickness={20}
                centerValue={formatPercent(savingsRate)}
                centerLabel="saved"
                formatValue={(v) => formatETB(v)}
                data={[
                  { name: "Spent", value: totalExpenses, color: "hsl(var(--chart-1))" },
                  { name: "Saved", value: Math.max(remaining, 0), color: "hsl(var(--chart-4))" },
                ]}
              />
            </Panel>
          </div>
        </Reveal>
      )}

      {/* ── Daily spending trend (full width) ── */}
      <Reveal index={6}>
        <Panel>
          <SectionHeader title="Daily Spending" caption={`Trend · ${ethMonthLabel}`} className="mb-3" />
          {dailyTrend.length > 0 ? (
            <TrendArea data={dailyTrend} xKey="date" yKey="amount" formatValue={(v) => `${(v / 1000).toFixed(0)}k`} />
          ) : (
            <Empty>No spending recorded yet</Empty>
          )}
        </Panel>
      </Reveal>

      {/* ── Loans overview ── */}
      {allLoans.length > 0 && (
        <Reveal index={7}>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel>
              <SectionHeader title="Loans" caption="Active positions" className="mb-3" action={
                <Link to="/loans" className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
                  View <ChevronRight className="h-3 w-3" />
                </Link>
              } />
              {totalDebt + totalReceivable > 0 ? (
                <DonutStat
                  size={150}
                  thickness={20}
                  centerValue={formatETB(totalReceivable - totalDebt)}
                  centerLabel="net"
                  formatValue={(v) => formatETB(v)}
                  data={[
                    { name: `Debt (${activeTaken.length})`, value: totalDebt, color: "hsl(var(--chart-1))" },
                    { name: `Receivable (${activeGiven.length})`, value: totalReceivable, color: "hsl(var(--chart-4))" },
                  ]}
                />
              ) : (
                <Empty>No active balances</Empty>
              )}
            </Panel>
            <Panel padded={false} className="overflow-hidden">
              <div className="p-5 pb-2">
                <SectionHeader title="Loan Snapshot" caption="Key ratios" />
              </div>
              <div className="divide-y">
                <ListRow icon={Landmark} accent="hsl(var(--destructive))" title="Total Debt" subtitle={`${activeTaken.length} loans taken`} amount={totalDebt} amountColor="hsl(var(--destructive))" />
                <ListRow icon={HandCoins} accent="hsl(var(--success))" title="Total Receivable" subtitle={`${activeGiven.length} loans given`} amount={totalReceivable} amountColor="hsl(var(--success))" />
                <ListRow icon={Scale} accent="hsl(var(--warning))" title="Debt-to-Income" subtitle="Repayments vs income" value={formatPercent(debtToIncomeRatio)} />
              </div>
            </Panel>
          </div>
        </Reveal>
      )}

      {/* ── Recent activity + upcoming ── */}
      <Reveal index={8}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel padded={false} className="overflow-hidden">
            <div className="flex items-center justify-between p-5 pb-2">
              <SectionHeader title="Recent Activity" caption="Latest expenses" />
              <Link to="/expenses" className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
                All <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            {recentExpenses.length > 0 ? (
              <div className="divide-y">
                {recentExpenses.map((e) => (
                  <ListRow
                    key={e.id}
                    icon={CATEGORY_ICONS[e.category] ?? ShoppingCart}
                    accent="hsl(var(--primary))"
                    title={e.notes || e.category}
                    subtitle={e.category}
                    amount={Number(e.amount)}
                    sign="-"
                    meta={e.date.slice(5)}
                  />
                ))}
              </div>
            ) : (
              <div className="p-5"><Empty>No expenses this month</Empty></div>
            )}
          </Panel>

          <Panel padded={false} className="overflow-hidden">
            <div className="flex items-center justify-between p-5 pb-2">
              <SectionHeader title="Upcoming" caption="Next 7 days" />
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </div>
            {upcomingItems.length > 0 ? (
              <div className="divide-y">
                {upcomingItems.map((item) => (
                  <ListRow
                    key={item.id + item.dueDate.toISOString()}
                    icon={item.isOverdue ? AlertTriangle : RefreshCw}
                    accent={item.isOverdue ? "hsl(var(--destructive))" : "hsl(var(--info))"}
                    title={item.title}
                    subtitle={item.isOverdue ? "Overdue" : item.category || "Recurring"}
                    amount={item.amount}
                    amountColor={item.isOverdue ? "hsl(var(--destructive))" : undefined}
                    meta={item.dueDate.toISOString().slice(5, 10)}
                  />
                ))}
              </div>
            ) : (
              <div className="p-5"><Empty>Nothing scheduled</Empty></div>
            )}
          </Panel>
        </div>
      </Reveal>

    </div>
  );
}

/* ── local helpers ── */

function MiniStat({ label, amount, icon: Icon, tint, deltaPct, goodWhenUp }: {
  label: string; amount: number; icon: typeof Wallet; tint: string;
  deltaPct?: number | null; goodWhenUp?: boolean;
}) {
  const hasDelta = deltaPct != null && Number.isFinite(deltaPct);
  const up = hasDelta && (deltaPct as number) > 0;
  const flat = hasDelta && Math.abs(deltaPct as number) < 0.5;
  const good = flat ? null : up === goodWhenUp;
  const deltaColor = good == null ? "text-muted-foreground" : good ? "text-success" : "text-destructive";
  return (
    <Card className="card-soft lift border-0">
      <CardContent className="flex items-center gap-3 p-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
             style={{ background: `color-mix(in oklab, ${tint} 14%, transparent)` }}>
          <Icon className="h-5 w-5" style={{ color: tint }} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <Money amount={amount} className="text-base text-foreground" />
          {hasDelta && (
            <p className={`mt-0.5 flex items-center gap-0.5 text-[11px] font-medium tnum ${deltaColor}`}>
              {flat ? "→" : up ? "↑" : "↓"} {Math.abs(deltaPct as number).toFixed(0)}% <span className="text-muted-foreground">vs last</span>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{children}</p>;
}
