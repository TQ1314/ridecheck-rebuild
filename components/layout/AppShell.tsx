"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import type { Profile } from "@/types/orders";
import { getDashboardPath, getRoleLabel, type Role } from "@/lib/utils/roles";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Package,
  User,
  LogOut,
  Users,
  Settings,
  ClipboardList,
  BarChart3,
  Bug,
  Eye,
  Menu,
  ChevronLeft,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/layout/Logo";

interface AppShellProps {
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

function getNavItems(role: Role): NavItem[] {
  if (role === "owner") {
    return [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/orders", label: "Order Queue", icon: Package },
      { href: "/admin/inspectors", label: "RideCheckers", icon: Wrench },
      { href: "/admin/audit", label: "Audit Log", icon: ClipboardList },
      { href: "/admin/users", label: "Users", icon: Settings },
    ];
  }
  if (role === "operations_lead") {
    return [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/orders", label: "Order Queue", icon: Package },
      { href: "/admin/inspectors", label: "RideCheckers", icon: Wrench },
    ];
  }
  if (role === "operations") {
    return [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/orders", label: "Order Queue", icon: Package },
      { href: "/admin/inspectors", label: "RideCheckers", icon: Wrench },
    ];
  }
  if (role === "platform") {
    return [{ href: "/platform", label: "Platform View", icon: BarChart3 }];
  }
  if (role === "inspector") {
    return [
      { href: "/inspector", label: "My Jobs", icon: Package },
    ];
  }
  if (role === "ridechecker" || role === "ridechecker_active") {
    return [
      { href: "/ridechecker/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/ridechecker/jobs", label: "My Jobs", icon: Package },
    ];
  }
  if (role === "qa") {
    return [{ href: "/qa/review", label: "QA Review", icon: Eye }];
  }
  if (role === "developer") {
    return [{ href: "/dev", label: "Dev View", icon: Bug }];
  }
  return [
    { href: "/orders", label: "My Orders", icon: Package },
    { href: "/profile", label: "Profile", icon: User },
  ];
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/auth/login");
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();
      if (data) setProfile(data as Profile);
      setLoading(false);
    }
    loadProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const role = (profile?.role || "customer") as Role;
  const navItems = getNavItems(role);
  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <div className="flex h-screen">
      <aside
        className={`${sidebarOpen ? "w-64" : "w-0 overflow-hidden"} flex-shrink-0 border-r bg-sidebar transition-all duration-200 flex flex-col`}
      >
        <div className="flex h-16 items-center gap-2 px-4 border-b">
          <Link
            href={getDashboardPath(role)}
            className="flex items-center gap-2 font-bold text-lg"
            data-testid="link-home-sidebar"
          >
            <Logo size={24} />
            <span>RideCheck</span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className="w-full justify-start gap-3"
                  size="sm"
                  data-testid={`nav-${item.label.toLowerCase().replace(/ /g, "-")}`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3"
                size="sm"
                data-testid="button-user-menu"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-left min-w-0">
                  <span className="text-sm font-medium truncate max-w-[140px]">
                    {profile?.full_name}
                  </span>
                  <Badge
                    variant="outline"
                    className="no-default-hover-elevate no-default-active-elevate text-[10px] px-1 py-0"
                  >
                    {getRoleLabel(role)}
                  </Badge>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>{profile?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {role === "customer" && (
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleLogout} data-testid="button-logout">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-16 items-center gap-4 border-b px-4">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            data-testid="button-sidebar-toggle"
          >
            {sidebarOpen ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </Button>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
