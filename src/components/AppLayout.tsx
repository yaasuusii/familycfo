import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { BottomNav } from "@/components/BottomNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Outlet, useLocation } from "react-router-dom";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/income": "Income",
  "/expenses": "Expenses",
  "/grocery": "Grocery Tracker",
  "/meal-planner": "Meal Planner",
  "/budgets": "Budgets",
  "/loans": "Loans",
  "/recurring": "Recurring",
  "/forecasting": "Forecasting",
  "/reports": "Reports",
  "/settings": "Settings",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/loans/")) return "Loan Details";
  return "Family CFO";
}

export function AppLayout() {
  const { pathname } = useLocation();
  const title = getPageTitle(pathname);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/70 glass px-4 md:px-6">
            <SidebarTrigger className="hidden md:flex" />
            <h1 className="flex-1 truncate font-display text-lg font-semibold tracking-tight text-foreground">{title}</h1>
            <ThemeToggle />
          </header>
          <div className="p-4 pb-24 md:p-6 md:pb-6">
            <Outlet />
          </div>
        </main>
        <BottomNav />
      </div>
    </SidebarProvider>
  );
}
