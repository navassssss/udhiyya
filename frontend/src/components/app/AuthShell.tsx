import { Logo } from "./Logo";
import gathering from "@/assets/qurbani-community.jpg";
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex min-w-0 flex-col p-5 md:p-10">
        <Logo />
        <div className="mx-auto w-full max-w-md flex-1 py-8 sm:py-14 lg:flex lg:flex-col lg:justify-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-cobalt">
            Your community. Your participation.
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold">{title}</h1>
          <p className="mt-3 text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
            Enterprise role-based security · Encrypted session tokens · Mahallu isolation
          </p>
        </div>
      </div>
      <div className="relative hidden lg:block">
        <img
          src={gathering}
          alt="A welcoming Eid community gathering"
          width={1536}
          height={1024}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 cover-shade" />
        <div className="absolute bottom-12 left-12 right-12 text-cover-foreground">
          <h2 className="max-w-md text-5xl font-bold">
            Together in faith.
            <br />
            Together in giving.
          </h2>
          <p className="mt-5">One Mahallu. A shared responsibility.</p>
        </div>
      </div>
    </div>
  );
}
export function Field({
  label,
  ...p
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        {...p}
        className="mt-1.5 h-11 w-full rounded-lg border border-border bg-card px-3.5 text-sm outline-none focus:border-cobalt focus:ring-2 focus:ring-ring/20"
      />
    </label>
  );
}
