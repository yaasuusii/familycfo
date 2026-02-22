import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  PiggyBank,
  BarChart3,
  Settings,
  LogOut,
  LineChart,
  Landmark,
  RefreshCw,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Income", url: "/income", icon: TrendingUp },
  { title: "Expenses", url: "/expenses", icon: TrendingDown },
  { title: "Grocery Tracker", url: "/grocery", icon: ShoppingCart },
  { title: "Budgets", url: "/budgets", icon: PiggyBank },
  { title: "Loans", url: "/loans", icon: Landmark },
  { title: "Recurring", url: "/recurring", icon: RefreshCw },
  { title: "Forecasting", url: "/forecasting", icon: LineChart },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { profile, role, signOut } = useAuth();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Wallet className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground">Household Finance</span>
            <span className="text-xs text-muted-foreground">ETB Currency</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-sidebar-foreground">{profile?.name ?? "User"}</span>
            <Badge variant="outline" className="mt-0.5 w-fit text-xs capitalize">{role ?? "member"}</Badge>
          </div>
          <button onClick={signOut} className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
