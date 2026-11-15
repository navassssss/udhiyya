import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  KeyRound,
  Mail,
  UserPlus,
  LogIn,
} from "lucide-react";
import { AuthShell, Field } from "@/components/app/AuthShell";
import { Button } from "@/components/app/Btn";
import { useAuth, type UserRole } from "@/services/auth";
import { GoogleSignIn } from "@/services/auth/GoogleSignIn";
import { toast } from "sonner";

type AuthMode = "signin" | "signup" | "forgot";

export function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { signIn, signUp, resetPassword, activeProvider } = useAuth();
  const nav = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // 1. Forgot password flow
      if (mode === "forgot") {
        const { error } = await resetPassword(email);
        setSubmitting(false);
        if (error) {
          toast.error(error.message || "Failed to send reset link");
        } else {
          toast.success("Password reset link sent to your email.");
          setMode("signin");
        }
        return;
      }

      // 2. Sign up flow
      if (mode === "signup") {
        const { error, user } = await signUp(email, password, {
          name: fullName || email.split("@")[0],
          role: "participant",
        });

        setSubmitting(false);
        if (error) {
          toast.error(error.message || "Sign up failed");
          return;
        }

        toast.success(
          user && !(user as any).confirmed_at && !(user as any).emailVerifiedAt
            ? "Account created! You can now sign in."
            : "Account registered and ready!",
        );

        setMode("signin");
        return;
      }

      // 3. Sign in flow (live NestJS JWT or Supabase)
      const { error, profile } = await signIn(email, password);
      setSubmitting(false);

      if (error) {
        toast.error(error.message || "Invalid email or password");
        return;
      }

      const activeRole = profile?.role || "participant";
      toast.success(`Welcome back, ${profile?.name || activeRole}!`);

      redirectForRole(activeRole);
    } catch (err: any) {
      setSubmitting(false);
      toast.error(err.message || "An unexpected authentication error occurred");
    }
  };

  const redirectForRole = (r: UserRole) => {
    switch (r) {
      case "super_admin":
        nav({ to: "/super-admin/$section", params: { section: "organisations" } });
        break;
      case "committee_admin":
        nav({ to: "/admin/$section", params: { section: "dashboard" } });
        break;
      case "volunteer":
        nav({ to: "/volunteer/$section", params: { section: "home" } });
        break;
      case "participant":
      default:
        nav({ to: "/participant/$section", params: { section: "overview" } });
        break;
    }
  };

  return (
    <AuthShell
      title="Assalamu Alaikum."
      subtitle={
        mode === "signin"
          ? "Welcome back to your community programme."
          : mode === "signup"
            ? "Register a new participant account."
            : "Reset your QurbaniOS account password."
      }
    >
      {/* Mode Tabs */}
      <div className="mb-6 flex rounded-lg border border-border bg-muted/40 p-1">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
            mode === "signin"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LogIn className="mr-1.5 inline size-3.5" />
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
            mode === "signup"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <UserPlus className="mr-1.5 inline size-3.5" />
          Register
        </button>
        <button
          type="button"
          onClick={() => setMode("forgot")}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
            mode === "forgot"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <KeyRound className="mr-1.5 inline size-3.5" />
          Recovery
        </button>
      </div>

      {/* Authentication Form */}
      <form className="space-y-4" onSubmit={handleSubmit}>
        {mode === "signup" && (
          <Field
            label="Full name"
            name="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Yusuf Ahmed"
            required
          />
        )}

        <Field
          label="Email address"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your.email@example.com"
          required
        />

        {mode !== "forgot" && (
          <Field
            label="Password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />
        )}

        <Button className="w-full" type="submit" disabled={submitting}>
          {submitting ? (
            "Authenticating…"
          ) : mode === "signin" ? (
            <>
              Sign in to portal
              <ArrowRight className="size-4" />
            </>
          ) : mode === "signup" ? (
            <>
              Create account
              <ArrowRight className="size-4" />
            </>
          ) : (
            <>
              Send recovery email
              <Mail className="size-4" />
            </>
          )}
        </Button>

        {mode === "signin" && (
          <div className="pt-2">
            <div className="relative my-3 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <span className="relative bg-card px-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                or
              </span>
            </div>
            <GoogleSignIn
              onSuccess={() => {
                redirectForRole("participant");
              }}
            />
          </div>
        )}

        <div className="flex items-center justify-between text-xs pt-1">
          {mode === "signin" ? (
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="text-muted-foreground hover:text-foreground"
            >
              Forgot password?
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="text-muted-foreground hover:text-foreground"
            >
              Back to sign in
            </button>
          )}
          <span className="text-muted-foreground text-[11px]">
            {activeProvider === "nestjs" ? "NestJS JWT Active" : "Supabase Auth Active"}
          </span>
        </div>
      </form>
    </AuthShell>
  );
}
