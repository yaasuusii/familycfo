import { LayoutDashboard, TrendingDown, TrendingUp, PiggyBank, Menu } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const tabs = [
  { title: "Home", url: "/", icon: LayoutDashboard, end: true },
  { title: "Expenses", url: "/expenses", icon: TrendingDown, end: false },
  { title: "Income", url: "/income", icon: TrendingUp, end: false },
  { title: "Budgets", url: "/budgets", icon: PiggyBank, end: false },
];

export function BottomNav() {
  const { setOpenMobile } = useSidebar();

  const linkClass =
    "flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.url}
          to={tab.url}
          end={tab.end}
          className={linkClass}
          activeClassName="text-primary"
        >
          <tab.icon className="h-5 w-5" />
          <span>{tab.title}</span>
        </NavLink>
      ))}
      <button
        type="button"
        onClick={() => setOpenMobile(true)}
        className={cn(linkClass, "active:text-primary")}
        aria-label="Open full menu"
      >
        <Menu className="h-5 w-5" />
        <span>More</span>
      </button>
    </nav>
  );
}
