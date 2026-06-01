import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useExpenses, getCurrentMonth } from "@/hooks/useFinanceData";
import { useMealPlan, useMeals, getWeekStart } from "@/hooks/useMealData";
import { useMarketPrices, useSaveMarketPrices, parsePriceList, type ParsedPrice } from "@/hooks/useMarketPrices";
import { aggregateGroceryList, addMarketCosts } from "@/lib/grocery";
import { formatETB, formatPercent } from "@/lib/format";
import { ShoppingCart, TrendingDown, Percent, CalendarDays, UtensilsCrossed, ChevronRight, ClipboardPaste, Tag, Check } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { toast } from "sonner";

export default function GroceryTracker() {
  const month = getCurrentMonth();
  const { data: allExpenses = [] } = useExpenses(month);

  // Meal plan data for current + previous weeks
  const weekStart = getWeekStart(new Date());
  const { data: mealPlan } = useMealPlan(weekStart);
  const { data: meals = [] } = useMeals(mealPlan?.id);

  const aiEstimatedCost = useMemo(
    () => meals.reduce((s: number, m: any) => s + Number(m.estimated_cost || 0), 0),
    [meals]
  );

  // Market prices
  const { data: marketPrices = [] } = useMarketPrices();

  // Market-price-based weekly budget (accurate) — falls back to AI estimate
  const marketWeeklyCost = useMemo(() => {
    if (meals.length === 0 || marketPrices.length === 0) return 0;
    const items = aggregateGroceryList(meals);
    const withCosts = addMarketCosts(items, marketPrices);
    return withCosts.reduce((s, i) => s + (i.buyCost ?? i.marketCost ?? 0), 0);
  }, [meals, marketPrices]);

  const plannedWeeklyCost = marketWeeklyCost > 0 ? marketWeeklyCost : aiEstimatedCost;
  const usingMarketPrices = marketWeeklyCost > 0;
  const saveMarketPrices = useSaveMarketPrices();
  const [showPasteDialog, setShowPasteDialog] = useState(false);
  const [showPricesDialog, setShowPricesDialog] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [parsedPreview, setParsedPreview] = useState<ParsedPrice[]>([]);

  const handleParse = () => {
    const parsed = parsePriceList(pasteText);
    setParsedPreview(parsed);
  };

  const handleSavePrices = () => {
    if (parsedPreview.length === 0) return;
    saveMarketPrices.mutate(parsedPreview, {
      onSuccess: () => {
        toast.success(`${parsedPreview.length} prices updated`);
        setShowPasteDialog(false);
        setPasteText("");
        setParsedPreview([]);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const lastUpdated = marketPrices.length > 0
    ? new Date(Math.max(...marketPrices.map((p) => new Date(p.updated_at).getTime()))).toLocaleDateString()
    : null;

  const categoryCount = useMemo(() => {
    const cats = new Set(marketPrices.map(p => p.category || "Other"));
    return cats.size;
  }, [marketPrices]);

  const groceryExpenses = useMemo(() => allExpenses.filter((e) => e.category === "Grocery"), [allExpenses]);
  const totalGrocery = groceryExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalExpenses = allExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const groceryPercent = totalExpenses > 0 ? (totalGrocery / totalExpenses) * 100 : 0;

  // This week's actual grocery spend
  const thisWeekGrocery = useMemo(() => {
    const ws = new Date(weekStart);
    const we = new Date(weekStart);
    we.setDate(we.getDate() + 6);
    return groceryExpenses
      .filter((e) => e.date >= ws.toISOString().slice(0, 10) && e.date <= we.toISOString().slice(0, 10))
      .reduce((s, e) => s + Number(e.amount), 0);
  }, [groceryExpenses, weekStart]);

  // Average weekly
  const now = new Date();
  const weeksElapsed = Math.max(1, Math.ceil(now.getDate() / 7));
  const avgWeekly = totalGrocery / weeksElapsed;

  // Trend
  const trend = useMemo(() => {
    const map: Record<string, number> = {};
    groceryExpenses.forEach((e) => { map[e.date] = (map[e.date] || 0) + Number(e.amount); });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date: date.slice(5), amount }));
  }, [groceryExpenses]);

  // Planned vs actual comparison data
  const comparisonData = useMemo(() => {
    if (plannedWeeklyCost === 0 && thisWeekGrocery === 0) return [];
    return [{ name: "This Week", planned: plannedWeeklyCost, actual: thisWeekGrocery }];
  }, [plannedWeeklyCost, thisWeekGrocery]);

  const savingsVsPlan = plannedWeeklyCost > 0 ? plannedWeeklyCost - thisWeekGrocery : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Grocery Tracker</h2>
        <Link
          to="/meal-planner"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <UtensilsCrossed className="h-4 w-4" /> Shopping List <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatCard title="Monthly Grocery" value={formatETB(totalGrocery)} icon={<ShoppingCart className="h-4 w-4 text-warning" />} />
        <StatCard title="Avg Weekly Spend" value={formatETB(avgWeekly)} icon={<CalendarDays className="h-4 w-4 text-primary" />} />
        <StatCard title={usingMarketPrices ? "Weekly Budget" : "Meal Plan Budget"} value={formatETB(plannedWeeklyCost)} icon={<UtensilsCrossed className="h-4 w-4 text-success" />} />
        <StatCard title="% of Expenses" value={formatPercent(groceryPercent)} icon={<Percent className="h-4 w-4 text-success" />} />
        <StatCard title="Transactions" value={String(groceryExpenses.length)} icon={<TrendingDown className="h-4 w-4 text-muted-foreground" />} />
      </div>

      {/* Planned vs Actual comparison */}
      {plannedWeeklyCost > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Planned vs Actual This Week</CardTitle>
              <Badge variant={savingsVsPlan >= 0 ? "default" : "destructive"} className={savingsVsPlan >= 0 ? "bg-green-600" : ""}>
                {savingsVsPlan >= 0 ? `${formatETB(savingsVsPlan)} under budget` : `${formatETB(Math.abs(savingsVsPlan))} over budget`}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {usingMarketPrices ? "Market price estimate" : "AI meal plan estimate"}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{formatETB(plannedWeeklyCost)}</span>
                {usingMarketPrices && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-300">
                    Market
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Actual grocery spend</span>
              <span className="font-medium">{formatETB(thisWeekGrocery)}</span>
            </div>
            <Progress
              value={plannedWeeklyCost > 0 ? Math.min((thisWeekGrocery / plannedWeeklyCost) * 100, 100) : 0}
              className="h-2.5"
            />
            <p className="text-xs text-muted-foreground">
              {plannedWeeklyCost > 0
                ? `${formatPercent((thisWeekGrocery / plannedWeeklyCost) * 100)} of weekly budget used`
                : "No meal plan budget set"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Market Prices — compact bar */}
      <Card>
        <CardContent className="flex items-center justify-between py-3 px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <Tag className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Market Prices</p>
              <p className="text-xs text-muted-foreground">
                {marketPrices.length > 0
                  ? `${marketPrices.length} items across ${categoryCount} categories${lastUpdated ? ` · Updated ${lastUpdated}` : ""}`
                  : "No prices yet — paste from Telegram to get started"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {marketPrices.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setShowPricesDialog(true)}>
                View All
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setShowPasteDialog(true)}>
              <ClipboardPaste className="h-4 w-4 mr-1" /> Paste Prices
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Grocery Spending Trend</CardTitle></CardHeader>
        <CardContent>
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trend}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatETB(v)} />
                <Line type="monotone" dataKey="amount" stroke="hsl(38,92%,50%)" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-muted-foreground py-8">No grocery expenses yet</p>}
        </CardContent>
      </Card>

      {/* Paste Prices Dialog */}
      <Dialog open={showPasteDialog} onOpenChange={setShowPasteDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Paste Market Prices</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Paste a price list from Telegram (ChipChip format). Example:
              </p>
              <pre className="text-xs bg-muted rounded-md p-2 whitespace-pre-wrap">
{`🧅 Red Onion Habesha (ሽንኩርት ሀበሻ) = 126 ETB/kg
🍅 Tomato A (ቲማቲም A) = 86 ETB/kg`}
              </pre>
            </div>
            <Textarea
              placeholder="Paste price list here..."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
            <div className="flex gap-2">
              <Button onClick={handleParse} variant="outline" disabled={!pasteText.trim()}>
                Parse Prices
              </Button>
              {parsedPreview.length > 0 && (
                <Badge variant="secondary">{parsedPreview.length} items found</Badge>
              )}
            </div>

            {parsedPreview.length > 0 && (
              <>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Amharic</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Category</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedPreview.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-muted-foreground">{p.nameAmharic || "—"}</TableCell>
                          <TableCell className="text-right">{formatETB(p.price)}</TableCell>
                          <TableCell>{p.unit}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{p.category}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button onClick={handleSavePrices} disabled={saveMarketPrices.isPending} className="w-full">
                  <Check className="h-4 w-4 mr-1" />
                  {saveMarketPrices.isPending ? "Saving..." : `Save ${parsedPreview.length} Prices`}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View All Prices Dialog */}
      <Dialog open={showPricesDialog} onOpenChange={setShowPricesDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Market Prices ({marketPrices.length} items)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {Object.entries(
              marketPrices.reduce<Record<string, typeof marketPrices>>((acc, p) => {
                const cat = p.category || "Other";
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(p);
                return acc;
              }, {})
            ).map(([category, items]) => (
              <div key={category}>
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Tag className="h-3 w-3" /> {category}
                  <Badge variant="secondary" className="text-[10px] ml-1">{items.length}</Badge>
                </h4>
                <div className="rounded-md border">
                  <Table>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium capitalize py-2">{item.name}</TableCell>
                          <TableCell className="text-muted-foreground text-xs py-2">{item.name_amharic || ""}</TableCell>
                          <TableCell className="text-right py-2 tabular-nums font-medium">
                            {formatETB(Number(item.price))}/{item.unit}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-2.5 p-3 sm:gap-3 sm:p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary sm:h-10 sm:w-10">{icon}</div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{title}</p>
          <p className="text-base font-semibold sm:text-lg">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
