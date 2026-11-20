import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, LifeBuoy, LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { toast } from "sonner";
import { Wordmark, BrandMark } from "@/components/brand/Wordmark";
import { Avatar } from "@/components/ui/misc";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Tooltip } from "@/components/ui/overlays";
import { HospitalSwitcher } from "./HospitalSwitcher";
import { logout } from "@/services/auth";
import { app } from "@/config/app";
import { navigation } from "@/config/navigation";
import { cn } from "@/lib/utils";

const COLLAPSE_KEY = "nn.sidebar.collapsed";

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav className={cn("flex flex-col", collapsed ? "w-full items-center gap-2" : "gap-5")}>
      {navigation.map((group, gi) => (
        <div key={gi} className={cn("flex flex-col gap-0.5", collapsed && "w-full items-center")}>
          {group.label && !collapsed && (
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-placeholder">{group.label}</p>
          )}
          {/* Collapsed: a thin divider stands in for the group label, keeping spacing even. */}
          {collapsed && gi > 0 && <span className="mb-1.5 h-px w-8 bg-border" aria-hidden />}
          {group.items.map(({ to, label, icon: Icon, end, badge }) => {
            const link = (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={onNavigate}
                aria-label={collapsed ? label : undefined}
                className={({ isActive }) =>
                  cn(
                    "group relative flex items-center gap-3 rounded-md text-sm font-medium transition-colors",
                    collapsed ? "h-10 w-10 justify-center" : "px-3 py-2",
                    isActive
                      ? "bg-primary-soft text-primary-hover"
                      : "text-muted-foreground hover:bg-muted hover:text-heading",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && !collapsed && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary" />}
                    <Icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-primary" : "")} />
                    {!collapsed && <span className="flex-1">{label}</span>}
                    {!collapsed && badge && (
                      <span className="rounded-pill bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{badge}</span>
                    )}
                  </>
                )}
              </NavLink>
            );
            // The tooltip wraps a span, not the NavLink: its trigger merges className as a string,
            // which would wipe out NavLink's className function (and with it all the item styles).
            return collapsed ? (
              <Tooltip key={to} content={label} side="right">
                <span className="flex">{link}</span>
              </Tooltip>
            ) : (
              link
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function WorkspaceCard({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signOut = async () => {
    try {
      await logout();
    } catch {
      toast.error("Could not sign out. Check your connection and try again.");
      return;
    }
    qc.clear();
    navigate("/login", { replace: true });
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {collapsed ? (
          <button className="mx-auto rounded-full" aria-label="Account">
            <Avatar label="NN" />
          </button>
        ) : (
          <button className="flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left shadow-soft transition-colors hover:border-primary-border">
            <Avatar label="NN" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-heading">{app.workspace.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{app.workspace.plan}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 text-placeholder" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  // Full-bleed pages (graph editor) manage their own padding.
  const fullBleed = /^\/graphs\/[^/]+/.test(location.pathname);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r bg-card transition-[width] duration-200 lg:flex",
          collapsed ? "w-[72px] items-center px-3" : "w-64 px-4",
        )}
      >
        <div className={cn("flex h-16 shrink-0 items-center", collapsed ? "justify-center" : "justify-between")}>
          {collapsed ? <BrandMark /> : <Wordmark />}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="rounded-sm p-1.5 text-placeholder hover:bg-muted hover:text-heading"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="mb-3 rounded-sm p-1.5 text-placeholder hover:bg-muted hover:text-heading"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
        <div className={cn("flex-1 overflow-y-auto pt-2 scrollbar-thin", collapsed && "flex w-full justify-center")}>
          <SidebarNav collapsed={collapsed} />
        </div>
        <div className={cn("flex flex-col gap-2 py-4", collapsed && "w-full items-center")}>
          {collapsed ? (
            <Tooltip content="Help & support" side="right">
              <a
                href={`mailto:${app.supportEmail}`}
                aria-label="Help & support"
                className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-heading"
              >
                <LifeBuoy className="h-[18px] w-[18px]" />
              </a>
            </Tooltip>
          ) : (
            <a
              href={`mailto:${app.supportEmail}`}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-heading"
            >
              <LifeBuoy className="h-[18px] w-[18px]" /> Help & support
            </a>
          )}
          <WorkspaceCard collapsed={collapsed} />
        </div>
      </aside>

      {/* Mobile top bar + drawer */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card px-4 lg:hidden">
        <Wordmark showProduct={false} />
        <div className="flex items-center gap-2">
          <HospitalSwitcher compact />
          <button
            className="rounded-md p-2 hover:bg-muted"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>
      {mobileOpen && (
        <div className="fixed inset-x-0 top-14 z-30 border-b bg-card px-4 py-4 shadow-card lg:hidden">
          <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
        </div>
      )}

      <main className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[72px]" : "lg:pl-64")}>
        {/* Desktop top bar: the super admin's hospital switcher, top right. 64px tall like the
            sidebar's logo row; its right edge lines up with the page content below. */}
        <div className="sticky top-0 z-20 hidden h-16 border-b bg-card/90 backdrop-blur lg:block">
          <div
            className={cn(
              "flex h-full items-center justify-end",
              fullBleed ? "px-4 md:px-6" : "mx-auto max-w-[1360px] px-4 md:px-8",
            )}
          >
            <HospitalSwitcher />
          </div>
        </div>
        {fullBleed ? (
          <Outlet />
        ) : (
          <div className="mx-auto max-w-[1360px] px-4 py-6 md:px-8 md:py-8">
            <Outlet />
          </div>
        )}
      </main>
    </div>
  );
}
