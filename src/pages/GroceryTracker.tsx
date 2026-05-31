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

  const plannedWeeklyCost = useMemo(
    () => meals.reduce((s: number, m: any) => s + Number(m.estimated_cost || 0), 0),
    [meals]
  );

  // Market prices
  const { data: marketPrices = [] } = useMarketPrices();
  const saveMarketPrices = useSaveMarketPrices();
  const [showPasteDialog, setShowPasteDialog] = useState(false);
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Monthly Grocery" value={formatETB(totalGrocery)} icon={<ShoppingCart className="h-4 w-4 text-warning" />} />
        <StatCard title="Avg Weekly Spend" value={formatETB(avgWeekly)} icon={<CalendarDays className="h-4 w-4 text-primary" />} />
        <StatCard title="Meal Plan Budget" value={formatETB(plannedWeeklyCost)} icon={<UtensilsCrossed className="h-4 w-4 text-success" />} />
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
              <span className="text-muted-foreground">Meal plan estimate</span>
              <span className="font-medium">{formatETB(plannedWeeklyCost)}</span>
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
                ? `${formatPercent((thisWeekGrocery / plannedWeeklyCost) * 100)} of meal plan budget used`
                : "No meal plan budget set"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Market Prices */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Market Prices</CardTitle>
              {lastUpdated && (
                <p className="text-xs text-muted-foreground mt-1">Last updated: {lastUpdated}</p>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowPasteDialog(true)}>
              <ClipboardPaste className="h-4 w-4 mr-1" /> Paste Prices
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {marketPrices.length > 0 ? (
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
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                      >
                        <div>
                          <span className="font-medium capitalize">{item.name}</span>
                          {item.name_amharic && (
                            <span className="text-muted-foreground ml-1 text-xs">({item.name_amharic})</span>
                          )}
                        </div>
                        <Badge variant="secondary" className="ml-2 shrink-0">
                          {formatETB(Number(item.price))}/{item.unit}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 space-y-2">
              <p className="text-muted-foreground">No market prices yet</p>
              <p className="text-xs text-muted-foreground">
                Paste a price list from your Telegram channel to get started
              </p>
            </div>
          )}
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
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
