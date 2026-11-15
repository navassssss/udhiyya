import { ReactNode } from "react";
import { Link, Navigate } from "@tanstack/react-router";
import { ShieldAlert, ArrowLeft, LogOut } from "lucide-react";
import { useAuth, type UserRole } from "@/services/auth";
import { useDemo } from "@/components/app/DemoStore";
import { Button, btn } from "@/components/app/Btn";

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  children: ReactNode;
}

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { profile, loading, signOut, isMockMode } = useAuth();
  const { account } = useDemo();

  // If auth is still loading session from Supabase
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs">Verifying authorization…</p>
        </div>
      </div>
    );
  }

  // If no session and not in mock mode, redirect to login
  if (!profile && !isMockMode) {
    return <Navigate to="/login" replace />;
  }

  // Active role resolved from authenticated profile, or DemoStore account when explicitly in mock mode
  const activeRole: UserRole =
    profile?.role ||
    (account?.role === "Super Admin"
      ? "super_admin"
      : account?.role === "Committee"
        ? "committee_admin"
        : account?.role === "Volunteer"
          ? "volunteer"
          : "participant");

  // Check if role is allowed
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(activeRole)) {
    const roleLabels: Record<UserRole, string> = {
      super_admin: "Super Admin",
      committee_admin: "Committee Admin",
      volunteer: "Volunteer",
      participant: "Participant",
    };

    const targetPortal =
      activeRole === "super_admin"
        ? "/super-admin/organisations"
        : activeRole === "committee_admin"
          ? "/admin/dashboard"
          : activeRole === "volunteer"
            ? "/volunteer/home"
            : "/participant/overview";

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="size-6" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-foreground">Access Restricted</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            You are signed in as{" "}
            <span className="font-semibold text-foreground">{roleLabels[activeRole]}</span> (
            {profile?.email || "Demo Session"}). This portal requires one of:{" "}
            <span className="font-medium text-foreground">
              {allowedRoles.map((r) => roleLabels[r]).join(", ")}
            </span>
            .
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link to={targetPortal as any} className={btn({ variant: "ink", size: "sm" })}>
              <ArrowLeft className="size-4" />
              Go to your {roleLabels[activeRole]} workspace
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await signOut();
                window.location.href = "/login";
              }}
            >
              <LogOut className="size-4" />
              Sign in with another account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
