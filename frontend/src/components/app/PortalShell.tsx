import { Link, useNavigate, Navigate } from "@tanstack/react-router";
import {
  Home,
  Settings2,
  Users,
  ClipboardList,
  Beef,
  Layers,
  Wallet,
  CreditCard,
  Receipt,
  CalendarDays,
  Activity,
  Package,
  SlidersHorizontal,
  Megaphone,
  BarChart3,
  LogOut,
  Bell,
  Menu,
  X,
  CheckSquare,
  AlertCircle,
  UserRound,
  HandHeart,
  MapPin,
  ArrowUpRight,
  Building2,
  ShieldCheck,
  LifeBuoy,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Logo } from "./Logo";
import { Button } from "./Btn";
import { useDemo } from "./DemoStore";
import { useAuth } from "@/services/auth";
import { isPlatformOwner } from "@/lib/platform";
export const adminNav = [
  { group: "Overview", slug: "dashboard", label: "Dashboard", icon: Home },
  {
    group: "Programme management",
    slug: "programme-setup",
    label: "Programme setup",
    icon: Settings2,
  },
  { group: "Programme management", slug: "households", label: "Households", icon: Users },
  {
    group: "Programme management",
    slug: "participants",
    label: "Participants",
    icon: ClipboardList,
  },
  { group: "Animals & allocation", slug: "animals", label: "Animal management", icon: Beef },
  { group: "Animals & allocation", slug: "groups", label: "Groups & allocation", icon: Layers },
  { group: "Finance", slug: "finance", label: "Finance dashboard", icon: Wallet },
  { group: "Finance", slug: "payments", label: "Payments", icon: CreditCard },
  { group: "Finance", slug: "expenses", label: "Expenses", icon: Receipt },
  { group: "People & operations", slug: "volunteers", label: "Volunteers", icon: Users },
  { group: "People & operations", slug: "scheduling", label: "Scheduling", icon: CalendarDays },
  {
    group: "People & operations",
    slug: "operations",
    label: "Operations monitoring",
    icon: Activity,
  },
  {
    group: "Distribution & communication",
    slug: "distribution-setup",
    label: "Distribution setup",
    icon: SlidersHorizontal,
  },
  {
    group: "Distribution & communication",
    slug: "distribution",
    label: "Distribution management",
    icon: Package,
  },
  {
    group: "Distribution & communication",
    slug: "communication",
    label: "Communication",
    icon: Megaphone,
  },
  { group: "Distribution & communication", slug: "reports", label: "Reports", icon: BarChart3 },
];
export const volunteerNav = [
  { slug: "home", label: "Home", icon: Home },
  { slug: "tasks", label: "My tasks", icon: CheckSquare },
  { slug: "department", label: "Department", icon: Layers },
  { slug: "schedule", label: "Schedule & team", icon: CalendarDays },
  { slug: "issues", label: "Issue reporting", icon: AlertCircle },
  { slug: "updates", label: "Updates & profile", icon: UserRound },
];
export const participantNav = [
  { slug: "overview", label: "Overview", icon: Home },
  { slug: "registration", label: "My registration", icon: ClipboardList },
  { slug: "household", label: "Household", icon: Users },
  { slug: "participation", label: "Participation", icon: ShieldCheck },
  { slug: "payments", label: "Payments & receipts", icon: CreditCard },
  { slug: "allocation", label: "Group allocation", icon: Layers },
  { slug: "collection", label: "My collection", icon: Package },
  { slug: "updates", label: "Updates", icon: Bell },
];
export const superAdminNav = [
  { slug: "dashboard", label: "Platform dashboard", icon: Home },
  { slug: "organisations", label: "Organisations", icon: Building2 },
  { slug: "access", label: "Admin & access", icon: ShieldCheck },
  { slug: "features", label: "Plans & features", icon: SlidersHorizontal },
  { slug: "settings", label: "Platform settings", icon: Settings2 },
  { slug: "support", label: "Support & requests", icon: LifeBuoy },
  { slug: "activity", label: "Activity & audit", icon: Activity },
];
export function PortalShell({
  kind,
  section,
  children,
}: {
  kind: "admin" | "volunteer" | "participant" | "super-admin";
  section: string;
  children: ReactNode;
}) {
  const { account, ready, logout } = useDemo();
  const { profile, signOut: authSignOut, isConfigured } = useAuth();
  const nav = useNavigate();
  const [menu, setMenu] = useState(false);
  const list =
    kind === "super-admin"
      ? superAdminNav
      : kind === "admin"
        ? adminNav
        : kind === "volunteer"
          ? volunteerNav
          : participantNav;
  const expected =
    kind === "super-admin"
      ? "Super Admin"
      : kind === "admin"
        ? "Committee"
        : kind === "volunteer"
          ? "Volunteer"
          : "Participant";

  const isMockMode = import.meta.env.VITE_USE_MOCK_API === "true";

  // Check role match from authenticated profile or DemoStore account in mock mode
  const activeRole =
    profile?.role === "super_admin"
      ? "Super Admin"
      : profile?.role === "committee_admin"
        ? "Committee"
        : profile?.role === "volunteer"
          ? "Volunteer"
          : profile?.role === "participant"
            ? "Participant"
            : (isMockMode ? account?.role : undefined);

  if (!ready)
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        Opening your workspace…
      </div>
    );

  if (!profile && !isMockMode) {
    return <Navigate to="/login" replace />;
  }

  if (activeRole !== expected) {
    return <Navigate to="/login" replace />;
  }

  const displayName = profile?.name || account?.name || "User";
  const displayEmail = profile?.email || account?.department || expected;
  return (
    <div className="min-h-screen lg:flex">
      <aside
        className={`${menu ? "fixed inset-0 z-40 flex" : "hidden"} h-dvh flex-col border-r border-border bg-card lg:sticky lg:top-0 lg:z-auto lg:flex lg:h-dvh lg:w-60 lg:shrink-0`}
      >
        <div className="flex h-20 shrink-0 items-center justify-between px-5">
          <Logo />
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            aria-label="Close menu"
            onClick={() => setMenu(false)}
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="mx-4 mb-4 flex items-center gap-2 rounded-lg border border-border bg-background p-3">
          <span className="grid size-8 place-items-center rounded-md bg-accent text-cobalt">
            <HandHeart className="size-4" />
          </span>
          <div>
            <p className="text-xs font-semibold">
              {kind === "super-admin" ? "QurbaniOS Platform" : "Aḍḥiyah 2027"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {kind === "super-admin" ? "Platform owner · Demo" : `Demo Mahallu · ${expected}`}
            </p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-5">
          {list.map((l, i) => {
            const group = "group" in l ? String(l.group) : null;
            const prev = list[i - 1];
            return (
              <div key={l.slug}>
                {group && (!prev || !("group" in prev) || prev.group !== group) && (
                  <p className="mb-2 mt-4 px-3 text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
                    {group}
                  </p>
                )}
                <Link
                  to={
                    kind === "super-admin"
                      ? "/super-admin/$section"
                      : kind === "admin"
                        ? "/admin/$section"
                        : kind === "volunteer"
                          ? "/volunteer/$section"
                          : "/participant/$section"
                  }
                  params={{ section: l.slug }}
                  onClick={() => setMenu(false)}
                  className={`mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2.5 text-xs transition-colors ${section === l.slug ? "bg-accent font-semibold text-cobalt" : "text-muted-foreground hover:bg-muted"}`}
                >
                  <l.icon className="size-4 shrink-0" />
                  {l.label}
                </Link>
              </div>
            );
          })}
        </nav>
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold">
              {displayName
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{displayName}</p>
              <p className="truncate text-[10px] text-muted-foreground">{displayEmail}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Log out"
              onClick={async () => {
                await authSignOut();
                logout();
                nav({ to: "/login" });
              }}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-card px-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              aria-label="Open menu"
              onClick={() => setMenu(true)}
            >
              <Menu className="size-5" />
            </Button>
            <p className="min-w-0 text-xs text-muted-foreground">
              <span className="hidden sm:inline">
                {expected} workspace <span className="mx-2">/</span>
              </span>
              <span className="block truncate text-foreground sm:inline">
                {list.find((l) => l.slug === section)?.label || "Registration details"}
              </span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span
              className={`hidden rounded-md px-2 py-1 text-[10px] font-medium sm:block ${
                isConfigured ? "bg-emerald-500/10 text-emerald-700" : "bg-sun/20 text-foreground"
              }`}
            >
              {isConfigured ? "Live Supabase session" : "Sample data · not live"}
            </span>
            <Link
              to="/"
              className="flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap text-xs"
            >
              Public site
              <ArrowUpRight className="size-3" />
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] p-4 pb-24 md:p-8">{children}</main>
      </div>
      {kind === "volunteer" && (
        <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-border bg-card py-3 lg:hidden">
          {volunteerNav
            .filter((l) => ["home", "tasks", "department", "updates"].includes(l.slug))
            .map((l) => (
              <Link
                key={l.slug}
                to="/volunteer/$section"
                params={{ section: l.slug }}
                className={`flex flex-col items-center gap-1 text-[10px] ${section === l.slug ? "text-cobalt" : "text-muted-foreground"}`}
              >
                <l.icon className="size-5" />
                {l.label}
              </Link>
            ))}
        </nav>
      )}
    </div>
  );
}
