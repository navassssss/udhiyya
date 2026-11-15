import { Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowRight, Plus, Printer } from "lucide-react";
import { toast } from "sonner";
import { useParticipant } from "./ParticipantSession";
import { useDemo } from "./DemoStore";
import { PageTitle, Metrics, Timeline, Status, DataTable, Modal, SelectField } from "./WorkflowUI";
import { Button, btn } from "./Btn";
import { Field } from "./AuthShell";
import { money, sample, verifiedBalance, type Row } from "@/lib/workflow";
import { financeAdapter, publicApi, registrationAdapter } from "@/services/api";
import { useAuth } from "@/services/auth";
import type { Participant } from "@/lib/programme";
export const participantSections = [
  { slug: "registration", label: "My registration" },
  { slug: "household", label: "Household" },
  { slug: "participation", label: "Participation" },
  { slug: "payments", label: "Payments & receipts" },
  { slug: "allocation", label: "Group allocation" },
  { slug: "collection", label: "My collection" },
  { slug: "updates", label: "Updates" },
  { slug: "profile", label: "Profile & support" },
];
export function ParticipantWorkspace({ section }: { section: string }) {
  const { participant, enter } = useParticipant();
  const { profile } = useAuth();
  const { records, add } = useDemo();
  const [payment, setPayment] = useState(false);
  const [viewReceipt, setViewReceipt] = useState<Row | null>(null);
  const [liveScope, setLiveScope] = useState<{ orgId: string; programmeId: string } | null>(null);

  const activeParticipant: Participant = participant || {
    name: profile?.name || "Participant",
    email: profile?.email || "participant@example.com",
    activity: "Participant",
    reference: "QOS-2027-001",
    household: "HH-001",
    shares: 1,
    status: "Approved",
  };

  useEffect(() => {
    let cancelled = false;
    async function loadLiveData() {
      if (!activeParticipant?.reference) return;
      try {
        const orgId =
          profile?.orgId ||
          import.meta.env.VITE_PUBLIC_ORGANISATION_ID ||
          "e775b56d-38e8-42ee-9a24-9b0e51582ca5";
        const year = Number(import.meta.env.VITE_PUBLIC_PROGRAMME_YEAR || 2027);
        const programme = await publicApi.getProgramme(orgId, year);
        if (!programme.id) throw new Error("Published programme ID is unavailable");
        const scope = { orgId, programmeId: programme.id };
        if (!cancelled) setLiveScope(scope);
        const [livePayments] = await Promise.all([
          financeAdapter.myPayments(scope.orgId, scope.programmeId),
          registrationAdapter.myRegistration(scope.orgId, scope.programmeId),
        ]);
        if (cancelled) return;
        if (livePayments?.items && Array.isArray(livePayments.items)) {
          livePayments.items.forEach((p: any) => {
            if (!records.payments.some((existing) => existing.id === p.id)) {
              add("payments", {
                id: p.id,
                participant: activeParticipant.reference || "QOS-2027-001",
                name: activeParticipant.name,
                amount: String(p.amountMinor ? p.amountMinor / 100 : p.amount || 0),
                method: p.method || "Cash",
                date: p.receivedAt?.slice(0, 10) || "2027-05-10",
                status:
                  p.status === "verified"
                    ? "Verified"
                    : p.status === "rejected"
                      ? "Rejected"
                      : "Pending verification",
              });
            }
          });
        }
      } catch {
        // Fall back gracefully to local demo store
      }
    }
    loadLiveData();
    return () => {
      cancelled = true;
    };
  }, [activeParticipant?.reference, profile?.orgId]);

  const reference = activeParticipant.reference || "QOS-2027-001";
  const registration = records.participants.find((p) => p.id === reference);
  const status = registration?.status || activeParticipant.status || "Pending review";
  const shares = Number(registration?.shares || activeParticipant.shares || 1);
  const contribution = shares * sample.price;
  const verified = verifiedBalance(records.payments, reference);
  const group = records.groups.find(
    (g) => g.status === "Published" && g.participants.split(",").includes(reference),
  );
  const packageRow = records.distribution.find(
    (d) => d.recipient === reference && d.status !== "Pending allocation",
  );
  const household = records.households.find(
    (h) => h.id === (registration?.household || activeParticipant.household),
  );
  const title =
    section === "overview"
      ? `Assalamu Alaikum, ${activeParticipant.name.split(" ")[0]}.`
      : participantSections.find((s) => s.slug === section)?.label || "My participation";
  return (
    <>
      <PageTitle
        eyebrow="Participant · Aḍḥiyah 2027"
        title={title}
        description={`${reference} · Your participation, from registration to collection.`}
      />
      {section === "overview" && (
        <>
          <Metrics
            items={[
              { label: "Registration", value: status },
              { label: "Your shares", value: shares },
              { label: "Verified payments", value: money(verified) },
              { label: "Outstanding", value: money(Math.max(0, contribution - verified)) },
            ]}
          />
          <div className="grid gap-10 lg:grid-cols-2">
            <section>
              <h2 className="mb-6 text-xl font-bold">Your programme journey</h2>
              <Timeline
                steps={[
                  "Registration submitted",
                  "Committee approval",
                  "Payment verified",
                  "Group assignment",
                  "Preparation & packaging",
                  "Collection confirmed",
                ]}
                active={
                  packageRow?.status === "Collected"
                    ? 5
                    : group
                      ? 3
                      : verified >= contribution
                        ? 2
                        : status === "Approved"
                          ? 1
                          : 0
                }
              />
              <Link
                to="/dashboard/$section"
                params={{ section: "registration" }}
                className={btn({ variant: "outline", className: "mt-6" })}
              >
                View registration
                <ArrowRight className="size-4" />
              </Link>
            </section>
            <section>
              <h2 className="mb-5 text-xl font-bold">What happens next?</h2>
              <div className="border-l-2 border-cobalt pl-5">
                <p className="font-semibold">
                  {status === "Approved"
                    ? "Your participation is approved."
                    : "Your application is with the committee."}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {status === "Approved"
                    ? "Follow your payments and group allocation. Collection information appears after confirmation."
                    : "The committee will review your household, participant details and share request. Approval is required before allocation."}
                </p>
              </div>
            </section>
          </div>
        </>
      )}
      {section === "registration" && (
        <>
          <div className="mb-6">
            <Status>{status}</Status>
          </div>
          <dl className="max-w-2xl divide-y divide-border">
            {[
              ["Reference", reference],
              ["Participant", activeParticipant.name],
              ["Contact", activeParticipant.email],
              [
                "Household",
                registration?.household || activeParticipant.household || "Pending verification",
              ],
              ["Participation", `${shares} cattle shares`],
              ["Contribution", money(contribution)],
              ["Committee review", registration?.review || "Awaiting review"],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[120px_1fr] gap-4 py-4 text-sm">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="break-words font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      {section === "household" && (
        <>
          <h2 className="text-xl font-bold">
            {household?.name || "Household verification pending"}
          </h2>
          <p className="mt-4 text-sm text-muted-foreground">
            {household?.address || "Submitted household information is awaiting review."}
          </p>
          <p className="mt-3 text-sm">
            {household?.id || activeParticipant.household} · {household?.members || "—"} members
          </p>
          <p className="mt-6 text-xs text-muted-foreground">
            Other family members are not automatically registered through this household record.
          </p>
        </>
      )}
      {section === "participation" && (
        <>
          <Metrics
            items={[
              { label: "Participation option", value: "Cattle share" },
              { label: "Selected shares", value: shares },
              { label: "Price per share", value: money(sample.price) },
              { label: "Total contribution", value: money(contribution) },
            ]}
          />
          <Status>{status}</Status>
          <p className="mt-5 text-sm text-muted-foreground">
            Participation selections are reviewed by the committee before group allocation.
          </p>
        </>
      )}
      {section === "payments" && (
        <>
          <Metrics
            items={[
              { label: "Contribution", value: money(contribution) },
              { label: "Verified payments", value: money(verified) },
              { label: "Outstanding", value: money(Math.max(0, contribution - verified)) },
              {
                label: "Pending submissions",
                value: records.payments.filter(
                  (p) => p.participant === reference && p.status === "Pending verification",
                ).length,
              },
            ]}
          />
          <Button
            className="mb-5"
            disabled={status !== "Approved"}
            onClick={() => setPayment(true)}
          >
            <Plus className="size-4" />
            Submit payment record
          </Button>
          {status !== "Approved" && (
            <p className="mb-5 text-xs text-muted-foreground">
              Payment submission becomes available after committee approval.
            </p>
          )}
          <DataTable
            rows={records.payments.filter((p) => p.participant === reference)}
            columns={[
              { key: "id", label: "Reference" },
              { key: "amount", label: "Amount" },
              { key: "method", label: "Method" },
              { key: "status", label: "Verification" },
            ]}
            actions={(r) =>
              r.status === "Verified" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewReceipt(r)}
                >
                  <Printer className="size-4" />
                  Receipt
                </Button>
              )
            }
          />
          <p className="mt-5 text-xs text-muted-foreground">
            A submitted payment is not yet verified. Your official balance updates after committee
            verification.
          </p>
        </>
      )}
      {section === "allocation" && (
        <>
          <h2 className="text-xl font-bold">
            {group ? `Group ${group.id}` : "Assignment awaiting confirmation"}
          </h2>
          <p className="mt-4 text-sm text-muted-foreground">
            {group
              ? `Animal ${group.animal} · ${shares} shares · Committee-confirmed assignment`
              : "Approved registrations become eligible for group allocation. Your group appears once the committee confirms and publishes it."}
          </p>
          <div className="mt-5">
            <Status>{group ? "Assigned" : "Pending allocation"}</Status>
          </div>
        </>
      )}
      {section === "collection" && (
        <>
          <h2 className="text-xl font-bold">
            {packageRow ? packageRow.location : "Collection schedule awaiting confirmation"}
          </h2>
          <p className="mt-4 text-sm text-muted-foreground">
            {packageRow
              ? `${packageRow.quantity} kg · ${packageRow.time} · Sample schedule, date to be confirmed`
              : "Your personal quantity and collection window appear only after committee confirmation."}
          </p>
          {packageRow && (
            <div className="mt-5">
              <Status>{packageRow.status}</Status>
            </div>
          )}
          <p className="mt-6 text-sm text-muted-foreground">
            Keep your registration reference available. An assigned volunteer records collection
            after handover.
          </p>
        </>
      )}
      {section === "updates" &&
        records.announcements
          .filter(
            (a) => a.status === "Published" && ["All users", "Participants"].includes(a.audience),
          )
          .map((a) => (
            <article key={a.id} className="border-b border-border py-5">
              <p className="text-xs text-cobalt">{a.date}</p>
              <h2 className="mt-3 text-xl font-bold">{a.title}</h2>
              <p className="mt-3 text-sm text-muted-foreground">{a.message}</p>
            </article>
          ))}
      {section === "profile" && (
        <div className="grid gap-10 md:grid-cols-2">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              enter({
                ...activeParticipant,
                name: String(d.get("name")),
                email: String(d.get("contact")),
                activity: activeParticipant.activity || "Participant",
              });
              toast.success("Participant profile preferences saved");
            }}
          >
            <Field label="Full name" name="name" defaultValue={activeParticipant.name} required />
            <Field label="Contact" name="contact" defaultValue={activeParticipant.email} required />
            <Button>Save profile</Button>
          </form>
          <section>
            <h2 className="text-xl font-bold">Need a little help?</h2>
            <p className="mt-4 text-sm text-muted-foreground">
              committee@example.com · Sample contact
            </p>
            <Link to="/contact" className={btn({ variant: "outline", className: "mt-5" })}>
              Contact committee
            </Link>
          </section>
        </div>
      )}
      <Modal open={payment} onClose={() => setPayment(false)} title="Submit a payment record">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            const amount = Number(d.get("amount"));
            const method = String(d.get("method"));
            const date = String(d.get("date"));
            const refNote = String(d.get("reference") || "");

            if (!liveScope) {
              toast.error("Programme is still loading. Please try again.");
              return;
            }

            financeAdapter
              .recordPayment(liveScope.orgId, liveScope.programmeId, {
                registrationId: reference,
                amount: { amount, currency: "INR" },
                method: method.toLowerCase().replace(/\s+/g, "_") as any,
                reference: refNote,
                receivedAt: new Date(date).toISOString(),
              })
              .catch(() => {});

            add("payments", {
              id: `PAY-${records.payments.length + 1}`,
              participant: reference,
              name: activeParticipant.name,
              amount: String(amount),
              method,
              date,
              reference: refNote,
              status: "Pending verification",
            });
            toast.success("Payment submitted for committee verification");
            setPayment(false);
          }}
        >
          <Field label="Amount" name="amount" type="number" min={1} required />
          <SelectField label="Payment method" name="method" options={["Bank transfer", "Cash"]} />
          <Field label="Transaction date" name="date" type="date" required />
          <Field label="Transaction reference" name="reference" required />
          <label className="block text-sm">
            Supporting document
            <input type="file" className="mt-2 block text-xs" />
          </label>
          <Button>Submit for verification</Button>
          <p className="text-xs text-muted-foreground">
            Submitted payments remain pending until verified by the finance committee.
          </p>
        </form>
      </Modal>

      <Modal
        open={viewReceipt !== null}
        onClose={() => setViewReceipt(null)}
        title="Official payment receipt"
      >
        {viewReceipt && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="text-lg font-bold">QurbaniOS</h3>
                  <p className="text-xs text-muted-foreground">Community Aḍḥiyah Programme · 2027</p>
                </div>
                <Status>Verified</Status>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Receipt number</p>
                  <p className="font-mono font-medium">{viewReceipt.id}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date of receipt</p>
                  <p className="font-medium">{viewReceipt.date}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Received from</p>
                  <p className="font-medium">{viewReceipt.name || activeParticipant.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{reference}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Payment method</p>
                  <p className="font-medium">{viewReceipt.method}</p>
                </div>
              </div>
              <div className="mt-6 rounded-lg bg-accent/60 p-4 text-center">
                <p className="text-xs text-muted-foreground">Amount verified</p>
                <p className="text-2xl font-bold text-cobalt">{money(viewReceipt.amount)}</p>
              </div>
              <p className="mt-4 text-center text-[11px] text-muted-foreground">
                This receipt confirms that the specified contribution was received and audited by the finance committee.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setViewReceipt(null)}>
                Close
              </Button>
              <Button onClick={() => window.print()}>
                <Printer className="size-4" />
                Print receipt
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
