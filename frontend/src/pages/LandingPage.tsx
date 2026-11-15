import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Moon,
  MapPin,
  CalendarDays,
  ShieldCheck,
  Users,
  Heart,
  Megaphone,
  HandHeart,
} from "lucide-react";
import { PublicShell } from "@/components/app/PublicShell";
import { btn } from "@/components/app/Btn";
import { Status } from "@/components/app/WorkflowUI";
import { countdownValues } from "@/lib/programme";
import { sample, money } from "@/lib/workflow";
import { publicAdapter } from "@/services/public.adapter";
import { communicationsAdapter } from "@/services/backend.adapter";
import type { PublicProgramme } from "@/types/api";

const DEFAULT_ORG_ID = import.meta.env.VITE_DEFAULT_ORG_ID || "e775b56d-38e8-42ee-9a24-9b0e51582ca5";

export function LandingPage() {
  const [intro, setIntro] = useState(false);
  const [programme, setProgramme] = useState<PublicProgramme | null>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    publicAdapter.getPublicProgramme(DEFAULT_ORG_ID, 2027)
      .then(setProgramme)
      .catch(() => undefined);

    communicationsAdapter.publicAnnouncements(DEFAULT_ORG_ID, 2027)
      .then((res: any) => {
        if (res?.items) setAnnouncements(res.items);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem("eid-intro-seen")) {
        setIntro(true);
        sessionStorage.setItem("eid-intro-seen", "1");
        const id = setTimeout(() => setIntro(false), 2200);
        return () => clearTimeout(id);
      }
    } catch {
      setIntro(false);
    }
    return undefined;
  }, []);

  return (
    <PublicShell>
      {intro && (
        <div className="pointer-events-none fixed inset-0 z-[100] grid place-items-center bg-ink text-ink-foreground animate-intro">
          <div className="text-center">
            <Moon className="mx-auto size-12 text-lime" />
            <p className="mt-6 font-display text-5xl font-bold">
              QurbaniOS<span className="text-lime">.</span>
            </p>
            <p className="mt-4 text-sm text-ink-foreground/60">
              Together in faith. Together in giving.
            </p>
            <div className="mx-auto mt-8 h-1 w-40 overflow-hidden rounded-full bg-ink-soft">
              <div className="h-full w-full origin-left bg-lime animate-loading" />
            </div>
          </div>
        </div>
      )}
      <main>
        <section className="programme-grid border-b border-border">
          <div className="mx-auto max-w-7xl px-5 pb-10 pt-12 text-center sm:px-6 sm:pb-16 sm:pt-20 lg:pt-24">
            <div className="inline-flex max-w-full items-center gap-2 rounded-lg border border-ink bg-card px-3 py-2 text-xs font-medium shadow-pop animate-rise">
              <Moon className="size-3.5 shrink-0 text-cobalt" />
              <span>{programme?.status === "published" ? "Programme published" : programme?.status ? `Programme ${programme.status}` : "Planning active"}</span>
            </div>
            <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              Calicut Central · Aḍḥiyah 2027
            </p>
            <h1 className="mx-auto mt-6 max-w-5xl font-display text-5xl font-extrabold leading-[1.05] sm:text-6xl lg:text-8xl animate-rise">
              QurbaniOS<span className="text-cobalt">.</span>
            </h1>
            <h2 className="mx-auto mt-5 max-w-4xl text-3xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
              A{" "}
              <span className="decoration-primary decoration-8 underline underline-offset-4">
                shared blessing.
              </span>
            </h2>
            <p className="mx-auto mt-6 max-w-sm text-sm leading-relaxed text-muted-foreground sm:max-w-xl sm:text-base">
              Your community’s Aḍḥiyah programme, together.
            </p>
            <div className="mx-auto mt-8 grid max-w-sm gap-4 sm:mt-10 sm:flex sm:max-w-none sm:justify-center">
              <Link
                to="/signup"
                className={btn({ size: "lg", className: "border-ink shadow-pop press" })}
              >
                Participate
                <ArrowRight className="size-4" />
              </Link>
              <Link to="/programme" className={btn({ size: "lg", variant: "outline" })}>
                Explore programme
              </Link>
            </div>
          </div>
          <div className="relative mx-auto max-w-5xl px-5 pb-12 sm:px-8 sm:pb-16">
            <div className="overflow-hidden rounded-lg border border-ink bg-card shadow-pop">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="size-2 shrink-0 rounded-full bg-coral" />
                  <span className="size-2 shrink-0 rounded-full bg-sun" />
                  <span className="size-2 shrink-0 rounded-full bg-primary" />
                  <p className="ml-2 truncate text-xs font-medium">Programme overview</p>
                </div>
                <span className="text-[10px] text-muted-foreground">Sample</span>
              </div>
              <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4">
                {[
                  { value: programme?.title ? "2027" : "1448", label: "Programme Year", icon: Users },
                  { value: "Calicut Central", label: "Mahallu Locality", icon: Heart },
                  { value: "Halal Verified", label: "Operations", icon: HandHeart },
                  {
                    value: programme?.price?.amountMinor ? `₹${(programme.price.amountMinor / 100).toLocaleString("en-IN")}` : "₹2,500",
                    label: "Share Contribution",
                    icon: ShieldCheck,
                  },
                ].map((m) => (
                  <div key={m.label} className="min-w-0 px-5 py-6 sm:py-8">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-left text-[11px] text-muted-foreground">{m.label}</p>
                      <m.icon className="size-4 shrink-0 text-cobalt" />
                    </div>
                    <p className="mt-3 break-words text-left font-display text-2xl font-bold">
                      {m.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        <section className="border-b border-border bg-card">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-8 px-5 py-10 lg:grid-cols-4">
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Registration</p>
              <Status>{programme?.status === "published" ? "Open" : "Planning"}</Status>
            </div>
            <div className="md:border-l md:border-border md:pl-6">
              <p className="text-xs text-muted-foreground">Closes</p>
              <p className="mt-2 flex items-center gap-2 font-semibold">
                <CalendarDays className="size-4 text-cobalt" />
                {programme?.registrationClosesAt ? new Date(programme.registrationClosesAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : "01 Jun 2027"}
              </p>
            </div>
            <div className="md:border-l md:border-border md:pl-6">
              <p className="text-xs text-muted-foreground">Per share</p>
              <p className="mt-1.5 text-xl font-bold">
                {programme?.price?.amountMinor ? `₹${(programme.price.amountMinor / 100).toLocaleString("en-IN")}` : "₹2,500"}
              </p>
            </div>
            <div className="md:border-l md:border-border md:pl-6">
              <p className="text-xs text-muted-foreground">Until Eid</p>
              <div className="mt-2 flex gap-3">
                {countdownValues(null).map((v, i) => (
                  <div key={i}>
                    <p className="font-mono text-lg font-semibold">{v}</p>
                    <p className="text-[9px] text-muted-foreground">
                      {["DAYS", "HRS", "MIN", "SEC"][i]}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">Date unconfirmed</p>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-5 py-16 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">How it works</h2>
            </div>
            <Link to="/about" className="flex items-center gap-2 text-xs font-medium">
              Learn more
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-12">
            {[
              {
                icon: Users,
                n: "01",
                title: "Register",
                text: "Link your household. Choose your shares.",
              },
              {
                icon: ShieldCheck,
                n: "02",
                title: "Committee review",
                text: "Your committee confirms the arrangements.",
              },
              {
                icon: HandHeart,
                n: "03",
                title: "Collect & share",
                text: "Receive your confirmed collection details.",
              },
            ].map((s) => (
              <div key={s.n} className="border-t border-border pt-5">
                <div className="flex items-center justify-between">
                  <s.icon className="size-6 text-cobalt" />
                  <span className="font-mono text-xs text-muted-foreground">{s.n} /</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="border-t border-border">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:py-20">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
              <h2 className="text-2xl font-bold">Latest updates</h2>
              <Link to="/announcements" className="flex items-center gap-2 text-xs font-medium">
                View all
                <ArrowUpRight className="size-4" />
              </Link>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {announcements.length > 0 ? (
                announcements.slice(0, 3).map((a: any) => (
                  <article key={a.id} className="rounded-lg border border-border bg-card p-6 lift">
                    <div className="flex items-center justify-between">
                      <Megaphone className="size-4 text-cobalt" />
                      <p className="text-[10px] text-muted-foreground">{a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : "Latest"}</p>
                    </div>
                    <h3 className="mt-5 text-lg font-semibold">{a.title}</h3>
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{a.body}</p>
                    <Link
                      to="/announcements"
                      className="mt-5 flex items-center gap-2 text-xs text-cobalt"
                    >
                      Read notice
                      <ArrowRight className="size-3" />
                    </Link>
                  </article>
                ))
              ) : (
                <div className="col-span-full rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  <Megaphone className="mx-auto mb-2 size-6 text-muted-foreground/60" />
                  Official committee notices and programme schedules will appear here once published.
                </div>
              )}
            </div>
          </div>
        </section>
        <section className="bg-ink text-ink-foreground">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-8 px-5 py-12 sm:py-16">
            <div>
              <h2 className="text-2xl font-bold">A place for every household.</h2>
            </div>
            <Link to="/distribution" className={btn({ size: "md" })}>
              Public distribution
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
