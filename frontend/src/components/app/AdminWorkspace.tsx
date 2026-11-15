import { Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Plus,
  ArrowRight,
  Check,
  X,
  Upload,
  Download,
  Eye,
  AlertTriangle,
  FileText,
  Send,
  Printer,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useDemo } from "./DemoStore";
import { adminNav } from "./PortalShell";
import { Button, btn } from "./Btn";
import { Field } from "./AuthShell";
import {
  PageTitle,
  Metrics,
  DataTable,
  Modal,
  Status,
  SelectField,
  ExportButton,
  Timeline,
  type Column,
} from "./WorkflowUI";
import {
  money,
  sample,
  allocationError,
  canAllocateQuantity,
  verifiedBalance,
  type Row,
  normalizeRow,
} from "@/lib/workflow";
import { useAuth } from "@/services/auth";
import { ProgrammeSetupSection } from "./ProgrammeSetupSection";
import { AnalyticsDashboard } from "@/components/extensions/AnalyticsDashboard";
import {
  financeAdapter,
  registrationAdapter,
  animalsAdapter,
  householdsAdapter,
  distributionAdapter,
  operationsAdapter,
  communicationsAdapter,
  reportsAdapter,
} from "@/services/api";
const config: Record<
  string,
  {
    entity: string;
    columns: Column[];
    fields: { key: string; label: string; options?: string[]; type?: string }[];
  }
> = {
  households: {
    entity: "households",
    columns: [
      { key: "id", label: "Household ID" },
      { key: "name", label: "Household head" },
      { key: "address", label: "Address" },
      { key: "members", label: "Members" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "name", label: "Household head" },
      { key: "address", label: "Address" },
      { key: "contact", label: "Mobile or email" },
      { key: "members", label: "Family members", type: "number" },
    ],
  },
  participants: {
    entity: "participants",
    columns: [
      { key: "id", label: "Registration" },
      { key: "name", label: "Participant" },
      { key: "household", label: "Household" },
      { key: "shares", label: "Shares" },
      { key: "amount", label: "Contribution" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "name", label: "Name" },
      { key: "household", label: "Household reference" },
      { key: "shares", label: "Shares", type: "number" },
    ],
  },
  animals: {
    entity: "animals",
    columns: [
      { key: "id", label: "Animal ID" },
      { key: "type", label: "Type" },
      { key: "supplier", label: "Supplier" },
      { key: "amount", label: "Purchase amount" },
      { key: "group", label: "Group" },
      { key: "status", label: "Procurement status" },
    ],
    fields: [
      { key: "type", label: "Animal type", options: ["Cattle", "Goat"] },
      { key: "supplier", label: "Supplier" },
      { key: "amount", label: "Purchase amount", type: "number" },
      { key: "date", label: "Procurement date", type: "date" },
      { key: "documentation", label: "Health / documentation notes" },
    ],
  },
  groups: {
    entity: "groups",
    columns: [
      { key: "id", label: "Group" },
      { key: "animal", label: "Animal" },
      { key: "capacity", label: "Capacity" },
      { key: "occupied", label: "Occupied shares" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "animal", label: "Verified animal" },
      { key: "capacity", label: "Available share capacity", type: "number" },
    ],
  },
  payments: {
    entity: "payments",
    columns: [
      { key: "id", label: "Payment reference" },
      { key: "name", label: "Participant" },
      { key: "amount", label: "Amount" },
      { key: "method", label: "Method" },
      { key: "date", label: "Date" },
      { key: "status", label: "Verification" },
    ],
    fields: [
      { key: "participant", label: "Participant reference" },
      { key: "amount", label: "Amount", type: "number" },
      { key: "method", label: "Payment method", options: ["Cash", "Bank transfer"] },
      { key: "date", label: "Transaction date", type: "date" },
    ],
  },
  expenses: {
    entity: "expenses",
    columns: [
      { key: "id", label: "Expense ID" },
      { key: "category", label: "Category" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount" },
      { key: "date", label: "Date" },
      { key: "method", label: "Method" },
    ],
    fields: [
      {
        key: "category",
        label: "Category",
        options: ["Animal procurement", "Supplies", "Transport", "Operations", "Other"],
      },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount", type: "number" },
      { key: "date", label: "Date", type: "date" },
      { key: "method", label: "Payment method", options: ["Cash", "Bank transfer"] },
    ],
  },
  volunteers: {
    entity: "volunteers",
    columns: [
      { key: "id", label: "Volunteer ID" },
      { key: "name", label: "Name" },
      { key: "department", label: "Department" },
      { key: "team", label: "Team" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "name", label: "Full name" },
      { key: "contact", label: "Login email or mobile" },
      {
        key: "department",
        label: "Assigned department",
        options: ["Slaughter", "Processing", "Distribution", "Finance"],
      },
      { key: "team", label: "Assigned team" },
      {
        key: "permissions",
        label: "Permissions",
        options: ["Assigned tasks only", "Team lead · assigned tasks"],
      },
    ],
  },
  scheduling: {
    entity: "scheduling",
    columns: [
      { key: "id", label: "Schedule ID" },
      { key: "activity", label: "Activity" },
      { key: "department", label: "Department" },
      { key: "time", label: "Time" },
      { key: "team", label: "Assigned team" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "activity", label: "Animal / task assignment" },
      {
        key: "department",
        label: "Department",
        options: ["Slaughter", "Processing", "Distribution", "Finance"],
      },
      { key: "team", label: "Team" },
      { key: "date", label: "Date", type: "date" },
      { key: "time", label: "Time", type: "time" },
      { key: "location", label: "Location" },
    ],
  },
  distribution: {
    entity: "distribution",
    columns: [
      { key: "id", label: "Package ID" },
      { key: "recipient", label: "Recipient reference" },
      { key: "pathway", label: "Pathway" },
      { key: "quantity", label: "Quantity (kg)" },
      { key: "location", label: "Location" },
      { key: "status", label: "Collection status" },
    ],
    fields: [
      { key: "recipient", label: "Recipient reference" },
      { key: "pathway", label: "Pathway", options: ["Participant share", "Community quota"] },
      { key: "quantity", label: "Quantity (kg)", type: "number" },
      { key: "location", label: "Collection location" },
      { key: "time", label: "Collection window" },
    ],
  },
  communication: {
    entity: "announcements",
    columns: [
      { key: "title", label: "Announcement" },
      { key: "audience", label: "Audience" },
      { key: "date", label: "Date" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "title", label: "Title" },
      { key: "message", label: "Message" },
      {
        key: "audience",
        label: "Target audience",
        options: [
          "All users",
          "Participants",
          "Volunteers",
          "Slaughter",
          "Processing",
          "Distribution",
          "Finance",
        ],
      },
    ],
  },
};
export function AdminWorkspace({
  section,
  initialSelectedId,
}: {
  section: string;
  initialSelectedId?: string;
}) {
  const { profile } = useAuth();
  const isFeatureEf01Enabled = import.meta.env.VITE_FEATURE_EF_01 !== "false";
  const { records, update, add, programmeStatus, setProgrammeStatus, policy, setPolicy } =
    useDemo();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All statuses");
  const [modal, setModal] = useState<string | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);

  useEffect(() => {
    if (initialSelectedId && records.participants) {
      const match = records.participants.find((p) => p.id === initialSelectedId);
      if (match) {
        setSelected(match);
        setModal("details");
      }
    }
  }, [initialSelectedId, records.participants]);
  const [importRows, setImportRows] = useState<Row[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStage, setImportStage] = useState(0);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importMap, setImportMap] = useState<Record<string, string>>({});
  const [allocationParticipant, setAllocationParticipant] = useState("");
  const [allocationGroup, setAllocationGroup] = useState("");
  const [taskDepartment, setTaskDepartment] = useState("Finance");
  const [taskVolunteer, setTaskVolunteer] = useState("");
  const [taskParticipant, setTaskParticipant] = useState("");
  const [error, setError] = useState("");
  const [report, setReport] = useState("participants");
  const cfg = config[section];
  const rows = cfg ? records[cfg.entity] || [] : [];
  const verified = records.payments
    .filter((p) => p.status === "Verified")
    .reduce((n, p) => n + Number(p.amount), 0);
  const expected = records.participants.reduce((n, p) => n + Number(p.amount), 0);
  const spent = records.expenses.reduce((n, p) => n + Number(p.amount), 0);
  const available = records.animals.reduce((n, a) => n + Number(a.weight), 0);
  const allocated = records.distribution
    .filter((d) => d.status !== "Pending allocation")
    .reduce((n, d) => n + Number(d.quantity), 0);
  const title = adminNav.find((n) => n.slug === section)?.label || "Registration details";
  function open(kind: string, row?: Row) {
    setError("");
    setSelected(row || null);
    if (kind === "task") {
      setTaskDepartment("Finance");
      const finVol = records.volunteers.find((v) => v.department === "Finance") || records.volunteers[0];
      if (finVol) setTaskVolunteer(`${finVol.name} (${finVol.id})`);
      if (records.participants.length > 0) {
        const p = records.participants[0];
        setTaskParticipant(`${p.name} · ${p.id} · Due: ${money(Number(p.amount) - verifiedBalance(records.payments, p.id))}`);
      }
    }
    setModal(kind);
  }
  function review(row: Row, status: string, reason?: string) {
    update("participants", row.id, {
      status,
      review: reason || `Committee ${status.toLowerCase()} this registration.`,
    });
    const action = status === "Approved" ? "approve" : status === "Rejected" ? "reject" : "cancel";
    registrationAdapter
      .decide(profile?.orgId || "org_demo", "2027", row.id, { action, reason })
      .catch(() => {});
    toast.success(`Registration ${status.toLowerCase()}`);
    setModal(null);
  }
  function verify(row: Row, status: string, reason?: string) {
    update("payments", row.id, { status, ...(reason ? { reason } : {}) });
    financeAdapter
      .verifyPayment(
        profile?.orgId || "org_demo",
        "2027",
        row.id,
        status === "Verified" ? "verify" : "reject",
        reason,
      )
      .catch(() => {});
    toast.success(
      status === "Verified"
        ? "Payment verified. Participant balance and receipt updated."
        : "Payment rejected. Verified balance unchanged.",
    );
  }
  function allocation() {
    const p = records.participants.find((p) => p.id === allocationParticipant);
    const g = records.groups.find((g) => g.id === allocationGroup);
    const issue = allocationError(p, g, records.groups);
    if (issue || !p || !g) {
      setError(issue || "Select a participant and group.");
      return;
    }
    update("groups", g.id, {
      occupied: String(Number(g.occupied) + Number(p.shares)),
      participants: [g.participants, p.id].filter(Boolean).join(","),
    });
    animalsAdapter
      .allocate(profile?.orgId || "org_demo", "2027", g.id, p.id, Number(p.shares || 1))
      .catch(() => {});
    toast.success("Participant allocated to group");
    setModal(null);
  }
  function confirmGroup(r: Row) {
    if (Number(r.occupied) !== Number(r.capacity)) {
      toast.error("Complete all configured shares before confirming this group.");
      return;
    }
    update("groups", r.id, { status: "Published" });
    animalsAdapter.createGroup(profile?.orgId || "org_demo", "2027", r).catch(() => {});
    toast.success("Group confirmed and assignment published.");
  }
  function generateAllocations() {
    const requested = records.distribution
      .filter((d) => d.status === "Pending allocation")
      .reduce((n, d) => n + Number(d.quantity), 0);
    if (!canAllocateQuantity(available, allocated, requested)) {
      toast.error(
        "Allocation exceeds recorded available quantity. Record actual processed weight first.",
      );
      return;
    }
    records.distribution
      .filter((d) => d.status === "Pending allocation")
      .forEach((d) => update("distribution", d.id, { status: "Allocated" }));
    toast.success("Recipient allocations generated within available quantity.");
  }
  function saveRecord(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!cfg) return;
    const d = Object.fromEntries(new FormData(e.currentTarget).entries());
    const fields = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, String(v)]));
    if (
      section === "groups" &&
      records.groups.some((g) => g.animal === fields["animal"] && g.id !== selected?.id)
    ) {
      setError("This animal is already assigned to a group.");
      return;
    }
    if (
      section === "groups" &&
      records.animals.find((a) => a.id === fields["animal"])?.status !== "Verified"
    ) {
      setError("Only verified animals can be assigned.");
      return;
    }
    if (
      section === "payments" &&
      !records.participants.some((p) => p.id === fields["participant"])
    ) {
      setError("Choose an existing participant reference.");
      return;
    }
    const id =
      selected?.id ||
      `${({ households: "QBH", participants: "QOS-2027", animals: "AN", groups: "GR", payments: "PAY", expenses: "EXP", volunteers: "VOL", scheduling: "SCH", distribution: "PKG", communication: "ANN" } as Record<string, string>)[section]}-${String(rows.length + 1).padStart(3, "0")}`;
    const status =
      section === "participants"
        ? "Pending review"
        : section === "animals"
          ? "Awaiting verification"
          : section === "groups"
            ? "Draft"
            : section === "payments"
              ? "Pending verification"
              : section === "expenses"
                ? "Recorded"
                : section === "communication"
                  ? "Draft"
                  : section === "scheduling"
                    ? "Scheduled"
                    : section === "distribution"
                      ? "Pending allocation"
                      : "Active";
    const row: Row = normalizeRow({ id, status, ...fields });
    if (section === "animals")
      Object.assign(row, { group: "Unassigned", stage: "Registered", weight: "0" });
    if (section === "groups")
      Object.assign(row, {
        occupied: selected?.occupied || "0",
        participants: selected?.participants || "",
      });
    if (section === "payments")
      row.name = records.participants.find((p) => p.id === row.participant)?.name || "";
    if (section === "participants")
      Object.assign(row, {
        amount: String(Number(fields["shares"]) * sample.price),
        paid: selected?.paid || "0",
      });
    if (section === "communication") row.date = "12 May 2027";
    if (selected) update(cfg.entity, id, fields);
    else add(cfg.entity, row);

    // Call live backend APIs where supported
    const orgId = profile?.orgId || "org_demo";
    if (section === "animals") {
      animalsAdapter
        .createAnimal(orgId, "2027", {
          reference: row.id,
          shareCapacity: Number(fields["capacity"] || 7),
        })
        .catch(() => {});
    } else if (section === "groups") {
      animalsAdapter
        .createGroup(orgId, "2027", {
          name: `Group ${id}`,
          animalId: fields["animal"] || "AN-001",
        })
        .catch(() => {});
    } else if (section === "expenses") {
      financeAdapter
        .createExpense(orgId, "2027", {
          categoryId: fields["category"] || "cat_general",
          amount: {
            amountMinor: Math.round(Number(fields["amount"] || 0) * 100),
            currency: "INR",
          },
          description: fields["description"] || fields["name"] || "Operational expense",
          incurredAt: new Date().toISOString(),
        })
        .catch(() => {});
    } else if (section === "communication") {
      communicationsAdapter
        .createAnnouncement(orgId, "2027", {
          title: fields["title"] || fields["name"] || "Announcement",
          body: fields["message"] || fields["description"] || "",
        })
        .catch(() => {});
    } else if (section === "households") {
      householdsAdapter
        .create(orgId, {
          name: fields["name"],
          address: fields["address"],
          phone: fields["contact"],
          membersCount: Number(fields["members"] || 1),
        })
        .catch(() => {});
    }

    toast.success(`${selected ? "Updated" : "Created"} ${title.toLowerCase() || "record"}`);
    setModal(null);
  }
  const metricItems =
    section === "households"
      ? [
          { label: "Total households", value: rows.length },
          { label: "Active households", value: rows.filter((r) => r.status === "Active").length },
          {
            label: "Newly added",
            value: rows.filter((r) => r.status === "Pending verification").length,
          },
          {
            label: "Incomplete records",
            value: rows.filter((r) => r.status === "Incomplete").length,
          },
        ]
      : section === "participants"
        ? [
            { label: "Total participants", value: rows.length },
            { label: "Approved", value: rows.filter((r) => r.status === "Approved").length },
            {
              label: "Pending review",
              value: rows.filter((r) => r.status === "Pending review").length,
            },
            {
              label: "Rejected / cancelled",
              value: rows.filter((r) => ["Rejected", "Cancelled"].includes(r.status)).length,
            },
          ]
        : section === "groups"
          ? [
              { label: "Total groups", value: rows.length },
              {
                label: "Available shares",
                value: rows.reduce((n, r) => n + Number(r.capacity) - Number(r.occupied), 0),
              },
              { label: "Occupied shares", value: rows.reduce((n, r) => n + Number(r.occupied), 0) },
              {
                label: "Unallocated approved",
                value: records.participants.filter(
                  (p) =>
                    p.status === "Approved" &&
                    !rows.some((g) => g.participants.split(",").includes(p.id)),
                ).length,
              },
            ]
          : section === "distribution"
            ? [
                { label: "Recorded available", value: `${available} kg` },
                { label: "Allocated quantity", value: `${allocated} kg` },
                {
                  label: "Packages collected",
                  value: rows.filter((d) => d.status === "Collected").length,
                },
                {
                  label: "Pending collection",
                  value: rows.filter((d) => d.status !== "Collected").length,
                },
              ]
            : [
                { label: "Total records", value: rows.length },
                {
                  label: "Completed / verified",
                  value: rows.filter((r) =>
                    ["Verified", "Completed", "Active", "Published"].includes(r.status),
                  ).length,
                },
                {
                  label: "Awaiting action",
                  value: rows.filter((r) => /Pending|Awaiting|Draft/.test(r.status)).length,
                },
                { label: "Programme year", value: "2027" },
              ];
  return (
    <>
      <PageTitle
        eyebrow="Committee · Aḍḥiyah 2027"
        title={section === "dashboard" ? "Assalamu Alaikum, Amina." : title}
        description={
          section === "dashboard"
            ? "A clear view of your programme, and what needs your attention today."
            : "Demo Mahallu · Sample records and interactive committee workflow"
        }
        actions={
          cfg && (
            <div className="flex flex-wrap gap-2">
              <ExportButton rows={rows} name={section} />
              {section === "households" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setImportStage(0);
                    open("import");
                  }}
                >
                  <Upload className="size-4" />
                  Import households
                </Button>
              )}
              {section === "groups" && (
                <>
                  <div data-testid="smart-allocation-slot" className="inline-block">
                    <Button
                      data-testid="ef02-smart-allocation-btn"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        toast.info("Smart Allocation Engine: Auto-pairing 7 participant shares per cattle group.");
                      }}
                    >
                      <Sparkles className="size-4" />
                      Smart allocation
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => open("allocate")}>
                    <Plus className="size-4" />
                    Allocate shares
                  </Button>
                </>
              )}
              {section === "distribution" && (
                <Button variant="outline" size="sm" onClick={generateAllocations}>
                  Generate allocations
                </Button>
              )}
              <Button size="sm" onClick={() => open("add")}>
                <Plus className="size-4" />
                {section === "communication"
                  ? "Create announcement"
                  : section === "groups"
                    ? "Create group"
                    : `Add ${section === "scheduling" ? "schedule" : section === "households" ? "household" : section === "participants" ? "participant" : section === "animals" ? "animal" : section === "payments" ? "payment" : section === "expenses" ? "expense" : section === "volunteers" ? "volunteer" : "package"}`}
              </Button>
            </div>
          )
        }
      />
      {section === "dashboard" && (
        <>
          {isFeatureEf01Enabled && (
            <div className="mb-8" data-testid="analytics-dashboard-slot">
              <AnalyticsDashboard programmeId={2027} />
            </div>
          )}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-accent/60 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-cobalt text-cover-foreground">
                <Check className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">Your programme is taking shape.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Registration is open. Review new participants and prepare the next milestone.
                </p>
              </div>
            </div>
            <Link
              to="/admin/$section"
              params={{ section: "participants" }}
              className="flex items-center gap-2 text-xs font-semibold text-cobalt"
            >
              Review registrations
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <Metrics
            items={[
              {
                label: "Participants",
                value: records.participants.length,
                note: `${records.participants.filter((p) => p.status === "Pending review").length} awaiting review`,
              },
              {
                label: "Verified collections",
                value: money(verified),
                note: "Finance-approved payments only",
              },
              {
                label: "Available shares",
                value: records.groups.reduce(
                  (n, g) => n + Number(g.capacity) - Number(g.occupied),
                  0,
                ),
                note: "Across configured groups",
              },
              {
                label: "Active volunteers",
                value: records.volunteers.filter((v) => v.status === "Active").length,
                note: "4 departments",
              },
            ]}
          />
          <div className="grid gap-8 xl:grid-cols-[1.7fr_1fr]">
            <section className="min-w-0">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold">Programme journey</h2>
                <Status>{programmeStatus}</Status>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  {
                    n: "01",
                    title: "Programme setup",
                    sub: "Published",
                    slug: "programme-setup",
                    done: true,
                  },
                  {
                    n: "02",
                    title: "Registration",
                    sub: "In progress",
                    slug: "participants",
                    done: false,
                  },
                  {
                    n: "03",
                    title: "Group allocation",
                    sub: "Next up",
                    slug: "groups",
                    done: false,
                  },
                  {
                    n: "04",
                    title: "Operations",
                    sub: "Preparing",
                    slug: "operations",
                    done: false,
                  },
                  {
                    n: "05",
                    title: "Distribution",
                    sub: "Not started",
                    slug: "distribution",
                    done: false,
                  },
                  {
                    n: "06",
                    title: "Closure & reports",
                    sub: "Upcoming",
                    slug: "reports",
                    done: false,
                  },
                ].map((s) => (
                  <Link
                    key={s.n}
                    to="/admin/$section"
                    params={{ section: s.slug }}
                    className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-cobalt"
                  >
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">{s.n}</span>
                      {s.done ? (
                        <Check className="size-4 text-cobalt" />
                      ) : (
                        <ArrowRight className="size-3 text-muted-foreground" />
                      )}
                    </div>
                    <h3 className="mt-6 break-words text-sm font-semibold">{s.title}</h3>
                    <p className="mt-2 text-[11px] text-muted-foreground">{s.sub}</p>
                  </Link>
                ))}
              </div>
              <h2 className="mb-5 mt-8 text-lg font-bold">Recent registrations</h2>
              <DataTable
                rows={records.participants}
                columns={[
                  { key: "name", label: "Participant" },
                  { key: "shares", label: "Shares" },
                  { key: "status", label: "Status" },
                ]}
                onOpen={(r) => open("details", r)}
              />
            </section>
            <section className="min-w-0">
              <h2 className="mb-5 text-lg font-bold">Needs your attention</h2>
              <div className="divide-y divide-border">
                {[
                  {
                    title: "Pending participant review",
                    n: records.participants.filter((p) => p.status === "Pending review").length,
                    slug: "participants",
                  },
                  {
                    title: "Payments to verify",
                    n: records.payments.filter((p) => p.status === "Pending verification").length,
                    slug: "payments",
                  },
                  {
                    title: "Animals awaiting checks",
                    n: records.animals.filter((a) => a.status !== "Verified").length,
                    slug: "animals",
                  },
                  {
                    title: "Operational issues",
                    n: records.issues.filter((i) => i.status !== "Resolved").length,
                    slug: "operations",
                  },
                ].map((a) => (
                  <Link
                    key={a.slug}
                    to="/admin/$section"
                    params={{ section: a.slug }}
                    className="flex items-center justify-between py-4 text-sm"
                  >
                    <span>{a.title}</span>
                    <span className="grid size-7 place-items-center rounded-md bg-sun/25 font-semibold">
                      {a.n}
                    </span>
                  </Link>
                ))}
              </div>
              <h2 className="mb-5 mt-8 text-lg font-bold">Collection snapshot</h2>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-bold">{money(verified)}</p>
                <p className="text-xs text-muted-foreground">of {money(expected)}</p>
              </div>
              <progress
                max={Math.max(expected, 1)}
                value={verified}
                className="mt-4 h-2 w-full accent-cobalt"
              />
              <p className="mt-3 text-xs text-muted-foreground">
                {Math.round((verified / Math.max(expected, 1)) * 100)}% collected · Verified
                payments only
              </p>
              <Link
                to="/admin/$section"
                params={{ section: "finance" }}
                className="mt-5 flex items-center gap-2 text-xs text-cobalt"
              >
                Open finance dashboard
                <ArrowRight className="size-3" />
              </Link>
            </section>
          </div>
        </>
      )}
      {cfg && (
        <>
          <Metrics items={metricItems} />
          <DataTable
            rows={rows}
            columns={cfg.columns}
            search={search}
            onSearch={setSearch}
            filter={filter}
            onFilter={setFilter}
            onOpen={(r) => open("details", r)}
            actions={(r) => (
              <>
                {section === "participants" && r.status === "Pending review" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Approve ${r.id}`}
                    onClick={() => review(r, "Approved")}
                  >
                    <Check className="size-4 text-cobalt" />
                  </Button>
                )}
                {section === "animals" && r.status !== "Verified" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      update("animals", r.id, { status: "Verified" });
                      toast.success("Animal verified");
                    }}
                  >
                    Verify
                  </Button>
                )}
                {section === "groups" && r.status !== "Published" && (
                  <Button variant="ghost" size="sm" onClick={() => confirmGroup(r)}>
                    Publish
                  </Button>
                )}
                {section === "payments" && r.status === "Pending verification" && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => verify(r, "Verified")}>
                      Verify
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        const reason = window.prompt("Reason for rejecting payment:");
                        if (reason !== null) {
                          verify(r, "Rejected", reason.trim() || "Payment audit rejected");
                        }
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                )}
                {section === "payments" && r.status === "Verified" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Receipt ${r.id}`}
                    onClick={() => open("receipt", r)}
                  >
                    <FileText className="size-4" />
                  </Button>
                )}
                {section === "communication" && r.status === "Draft" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      update("announcements", r.id, { status: "Published" });
                      communicationsAdapter
                        .publishAnnouncement(profile?.orgId || "org_demo", "2027", r.id)
                        .catch(() => {});
                      toast.success("Announcement published across active channels.");
                    }}
                  >
                    Publish
                  </Button>
                )}
                {section === "volunteers" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      update("volunteers", r.id, {
                        status: r.status === "Active" ? "Inactive" : "Active",
                      });
                      toast.success("Volunteer status updated");
                    }}
                  >
                    {r.status === "Active" ? "Deactivate" : "Activate"}
                  </Button>
                )}
              </>
            )}
          />
          {section === "households" && (
            <p className="mt-5 text-xs text-muted-foreground">
              Household imports do not register family members for participation.
            </p>
          )}
          {section === "payments" && (
            <p className="mt-5 text-xs text-muted-foreground">
              Only verified payments update official participant balances. Volunteer cash
              submissions stay in this queue.
            </p>
          )}
          {section === "volunteers" && (
            <div className="mt-8">
              <h2 className="mb-4 text-lg font-bold">Department responsibilities</h2>
              <div className="grid gap-4 md:grid-cols-4">
                {[
                  ["Slaughter", "Assigned animals & completion"],
                  ["Processing", "Actual weights & packaging"],
                  ["Distribution", "Recipient verification & handover"],
                  ["Finance", "Cash submissions, not verification"],
                ].map(([d, t]) => (
                  <div key={d} className="border-t border-border pt-4">
                    <p className="font-semibold">{d}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{t}</p>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="mt-5" onClick={() => open("task")}>
                Assign volunteer task
                <Plus className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}
      {section === "programme-setup" && (
        <ProgrammeSetupSection orgId={profile?.orgId || "org_demo"} />
      )}
      {section === "finance" && (
        <>
          <Metrics
            items={[
              { label: "Expected revenue", value: money(expected) },
              { label: "Verified collections", value: money(verified) },
              { label: "Outstanding", value: money(Math.max(0, expected - verified)) },
              { label: "Available balance", value: money(verified - spent) },
            ]}
          />
          <div className="grid gap-8 lg:grid-cols-2">
            <section className="min-w-0">
              <h2 className="mb-4 text-lg font-bold">Collection progress</h2>
              <div className="my-6 flex h-36 items-end gap-4">
                {[
                  { name: "Expected", value: expected, tone: "bg-muted" },
                  { name: "Verified", value: verified, tone: "bg-cobalt" },
                  { name: "Expenses", value: spent, tone: "bg-coral" },
                ].map((b) => (
                  <div
                    key={b.name}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                  >
                    <div
                      className={`${b.tone} w-full max-w-20 rounded-t-md`}
                      style={{
                        height: `${Math.max(5, (b.value / Math.max(expected, spent, 1)) * 100)}%`,
                      }}
                    />
                    <p className="text-[10px] text-muted-foreground">{b.name}</p>
                  </div>
                ))}
              </div>
              <p className="mt-7 text-sm">
                Total expenses <strong className="float-right">{money(spent)}</strong>
              </p>
              <Link
                to="/admin/$section"
                params={{ section: "expenses" }}
                className={btn({ variant: "outline", className: "mt-5" })}
              >
                Manage expenses
                <ArrowRight className="size-4" />
              </Link>
            </section>
            <section className="min-w-0">
              <h2 className="mb-4 text-lg font-bold">Payment verification queue</h2>
              <DataTable
                rows={records.payments.filter((p) => p.status === "Pending verification")}
                columns={[
                  { key: "name", label: "Participant" },
                  { key: "amount", label: "Amount" },
                ]}
                actions={(r) => (
                  <div className="flex items-center gap-1">
                    <Button size="sm" onClick={() => verify(r, "Verified")}>
                      Verify
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        const reason = window.prompt("Reason for rejecting payment:");
                        if (reason !== null) {
                          verify(r, "Rejected", reason.trim() || "Payment audit rejected");
                        }
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              />
              <h2 className="mb-4 mt-8 text-lg font-bold">Cash collection summary</h2>
              <p className="text-sm text-muted-foreground">
                Verified cash:{" "}
                <strong className="text-foreground">
                  {money(
                    records.payments
                      .filter((p) => p.method === "Cash" && p.status === "Verified")
                      .reduce((n, p) => n + Number(p.amount), 0),
                  )}
                </strong>
              </p>
            </section>
          </div>
        </>
      )}
      {section === "operations" && (
        <>
          <Metrics
            items={[
              { label: "Total animals", value: records.animals.length },
              {
                label: "Awaiting slaughter",
                value: records.animals.filter((a) => a.stage === "Awaiting slaughter").length,
              },
              {
                label: "Processing completed",
                value: records.animals.filter((a) => a.stage === "Processing completed").length,
              },
              {
                label: "Open issues",
                value: records.issues.filter((i) => i.status !== "Resolved").length,
              },
            ]}
          />
          <DataTable
            rows={records.animals}
            columns={[
              { key: "id", label: "Animal" },
              { key: "group", label: "Group" },
              { key: "stage", label: "Current stage" },
              { key: "weight", label: "Actual processed kg" },
            ]}
            onOpen={(r) => open("animal-stage", r)}
          />
          <h2 className="mb-4 mt-8 text-lg font-bold">Operational issues</h2>
          <DataTable
            rows={records.issues}
            columns={[
              { key: "category", label: "Category" },
              { key: "description", label: "Issue" },
              { key: "reference", label: "Reference" },
              { key: "status", label: "Status" },
            ]}
            actions={(r) => (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  update("issues", r.id, { status: "Resolved" });
                  toast.success("Issue resolved");
                }}
              >
                Resolve
              </Button>
            )}
          />
        </>
      )}
      {section === "distribution-setup" && (
        <form
          className="max-w-3xl space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            const p = Number(d.get("participant"));
            const b = Number(d.get("beneficiary"));
            if (p + b !== 100) {
              toast.error("Participant and beneficiary percentages must total 100%.");
              return;
            }
            setPolicy({ participant: p, beneficiary: b });
            toast.success("Sample distribution policy saved.");
          }}
        >
          <h2 className="text-xl font-bold">Distribution policy</h2>
          <p className="text-sm text-muted-foreground">
            Separate recipient pathways. One actual-quantity ledger.
          </p>
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Participant allocation (%)"
              name="participant"
              type="number"
              min={0}
              max={100}
              defaultValue={policy.participant}
            />
            <Field
              label="Public beneficiary allocation (%)"
              name="beneficiary"
              type="number"
              min={0}
              max={100}
              defaultValue={policy.beneficiary}
            />
            <Field label="Collection location" defaultValue="Community hall" />
            <Field label="Collection date — unconfirmed" type="date" />
          </div>
          <label className="block text-sm">
            Eligible household criteria
            <textarea
              className="mt-2 min-h-24 w-full rounded-lg border border-border bg-card p-3"
              defaultValue="Committee-verified recipient households, according to local programme criteria."
            />
          </label>
          <p className="rounded-lg bg-accent p-4 text-sm">
            Available actual quantity: <strong>{available} kg</strong> · Allocated:{" "}
            <strong>{allocated} kg</strong>
          </p>
          <Button>Save distribution policy</Button>
          <Link
            to="/admin/$section"
            params={{ section: "distribution" }}
            className={btn({ variant: "outline", className: "ml-3" })}
          >
            Manage allocations
          </Link>
        </form>
      )}
      {section === "reports" && (
        <>
          <div className="mb-7 flex flex-wrap gap-3">
            <SelectField label="Programme year" options={["2027"]} />
            <SelectField
              label="Report type"
              value={report}
              onChange={setReport}
              options={[
                "participants",
                "households",
                "animals",
                "groups",
                "payments",
                "expenses",
                "distribution",
              ]}
            />
            <SelectField
              label="Status"
              value={filter}
              onChange={setFilter}
              options={["All statuses", ...new Set((records[report] || []).map((r) => r.status))]}
            />
          </div>
          <div className="mb-5 flex flex-wrap gap-3">
            <ExportButton
              rows={(records[report] || []).filter(
                (r) => filter === "All statuses" || r.status === filter,
              )}
              name={report}
            />
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="size-4" />
              Print / Save PDF
            </Button>
            <Button variant="ink" size="sm" onClick={() => open("archive")}>
              Close & archive programme
            </Button>
          </div>
          <DataTable
            rows={records[report] || []}
            columns={Object.keys(records[report]?.[0] || { id: "" })
              .filter(
                (k) =>
                  !["contact", "participants"].includes(k) &&
                  (records[report] || []).some((r) => Boolean(r[k])),
              )
              .map((k) => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1) }))}
            filter={filter}
          />
          <div className="mt-8 border-t border-border pt-5">
            <h2 className="text-xl font-bold">Financial statement</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Collections {money(verified)} · Expenses {money(spent)} · Balance{" "}
              {money(verified - spent)}
            </p>
          </div>
        </>
      )}
      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={
          modal === "add"
            ? `New ${title || "record"}`
            : modal === "edit"
              ? `Edit ${title || "record"}`
              : modal === "import"
                ? "Import household directory"
                : modal === "allocate"
                  ? "Allocate approved participant"
                  : modal === "receipt"
                    ? "Verified payment receipt"
                    : modal === "task"
                      ? "Assign volunteer task"
                      : modal === "archive"
                        ? "Close annual programme"
                        : "Record details"
        }
      >
        {(modal === "add" || modal === "edit") && cfg && (
          <form className="space-y-4" onSubmit={saveRecord}>
            {cfg.fields.map((f) => {
              const options =
                section === "groups" && f.key === "animal"
                  ? records.animals.filter((a) => a.status === "Verified").map((a) => a.id)
                  : section === "payments" && f.key === "participant"
                    ? records.participants.map((p) => p.id)
                    : f.options;
              return options ? (
                <SelectField key={f.key} name={f.key} label={f.label} options={options} />
              ) : (
                <Field
                  key={f.key}
                  name={f.key}
                  label={f.label}
                  type={f.type || "text"}
                  min={f.type === "number" ? 1 : undefined}
                  defaultValue={selected?.[f.key] || ""}
                  required
                />
              );
            })}
            {section === "expenses" && (
              <label className="block text-sm">
                Supporting document
                <input type="file" className="mt-2 block w-full text-xs" />
              </label>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit">Save record</Button>
          </form>
        )}
        {modal === "details" && selected && (
          <>
            <dl className="divide-y divide-border">
              {Object.entries(selected)
                .filter(([_, v]) => v !== "" && v !== null && v !== undefined && v !== "—")
                .map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[120px_1fr] gap-4 py-2.5 text-sm">
                    <dt className="capitalize text-muted-foreground">{k.replace(/([A-Z])/g, " $1").trim()}</dt>
                    <dd className="break-words font-medium">{String(v)}</dd>
                  </div>
                ))}
            </dl>
            {(section === "participants" || section === "dashboard") && (
              <>
                <h3 className="mt-6 font-semibold">Payment summary</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Verified: {money(verifiedBalance(records.payments, selected.id))} · Contribution:{" "}
                  {money(selected.amount)}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button onClick={() => review(selected, "Approved")}>Approve</Button>
                  <Button variant="outline" onClick={() => open("reject", selected)}>
                    Reject with reason
                  </Button>
                  <Button variant="ghost" onClick={() => review(selected, "Cancelled")}>
                    Cancel registration
                  </Button>
                  <Link
                    to="/admin/registrations/$id"
                    params={{ id: selected.id }}
                    className={btn({ variant: "outline", size: "sm" })}
                  >
                    Full registration details
                  </Link>
                </div>
              </>
            )}
            {section === "payments" && selected.status === "Pending verification" && (
              <div className="mt-5 flex gap-2">
                <Button
                  onClick={() => {
                    verify(selected, "Verified");
                    setModal(null);
                  }}
                >
                  Verify payment
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    verify(selected, "Rejected");
                    setModal(null);
                  }}
                >
                  Reject payment
                </Button>
              </div>
            )}
            {section === "households" && (
              <>
                <h3 className="mt-5 font-semibold">Related registrations</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {records.participants
                    .filter((p) => p.household === selected.id)
                    .map((p) => `${p.id} · ${p.status}`)
                    .join(", ") || "No linked participation registrations"}
                </p>
              </>
            )}
            {cfg && (
              <Button variant="outline" className="mt-5" onClick={() => setModal("edit")}>
                Edit information
              </Button>
            )}
          </>
        )}
        {modal === "reject" && selected && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              review(selected, "Rejected", String(new FormData(e.currentTarget).get("reason")));
            }}
          >
            <Field name="reason" label="Rejection reason" required />
            <Button type="submit">Reject registration</Button>
          </form>
        )}
        {modal === "allocate" && (
          <div className="space-y-4">
            <SelectField
              label="Approved participant"
              value={allocationParticipant}
              onChange={setAllocationParticipant}
              options={[
                "",
                ...records.participants.filter((p) => p.status === "Approved").map((p) => p.id),
              ]}
            />
            <SelectField
              label="Group"
              value={allocationGroup}
              onChange={setAllocationGroup}
              options={["", ...records.groups.map((g) => g.id)]}
            />
            <p className="text-xs text-muted-foreground">
              Duplicate allocations and allocations beyond configured capacity are blocked.
            </p>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button onClick={allocation}>Confirm allocation</Button>
          </div>
        )}
        {modal === "receipt" && selected && (
          <div>
            <p className="text-xs text-muted-foreground">
              QurbaniOS · Aḍḥiyah 2027 · SAMPLE RECEIPT
            </p>
            <h2 className="mt-4 text-2xl font-bold">{money(selected.amount)}</h2>
            <p className="mt-3">{selected.name}</p>
            <p className="mt-2 font-mono text-sm">{selected.id}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {selected.date} · {selected.method}
            </p>
            <div className="mt-4">
              <Status>Verified</Status>
            </div>
            <Button variant="outline" className="mt-6" onClick={() => window.print()}>
              <Printer className="size-4" />
              Print receipt
            </Button>
          </div>
        )}
        {modal === "animal-stage" && selected && (
          <>
            <Timeline
              steps={[
                "Registered",
                "Allocated to group",
                "Slaughter completed",
                "Processing",
                "Packaging",
                "Distribution readiness",
              ]}
              active={
                selected.stage === "Processing completed"
                  ? 5
                  : selected.stage === "Awaiting processing"
                    ? 3
                    : 1
              }
            />
            <p className="mt-5 text-sm text-muted-foreground">
              Actual processed quantity: {selected.weight} kg. Assigned volunteers update progress
              in their workspace.
            </p>
          </>
        )}
        {modal === "task" && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              const dept = taskDepartment;
              const volunteer = records.volunteers.find(
                (v) => `${v.name} (${v.id})` === taskVolunteer || v.id === taskVolunteer || v.name === taskVolunteer,
              ) || records.volunteers[0];
              const participant = records.participants.find(
                (p) => `${p.name} · ${p.id}`.startsWith(taskParticipant.split(" · ")[0] || "") || p.id === taskParticipant,
              );
              const title =
                dept === "Finance" && participant
                  ? `Collect cash contribution for ${participant.name} (${participant.id})`
                  : String(d.get("name") || `${dept} operation task`);
              const ref = dept === "Finance" && participant ? participant.id : String(d.get("reference") || "");
              const volunteerId = volunteer?.id || "VOL-004";
              const volunteerName = volunteer?.name || "Nabeel Hassan";

              // 1. Send to backend if available
              operationsAdapter
                .createTask(profile?.orgId || "org_demo", "2027", {
                  department: dept.toLowerCase() as any,
                  assigneeId: volunteerId,
                  title,
                  resourceId: dept === "Finance" && participant ? participant.id : null,
                })
                .catch(() => {});

              // 2. Add to demo store for instant feedback
              add("tasks", {
                id: `TSK-${records.tasks.length + 1}`,
                name: title,
                department: dept,
                reference: ref,
                assigneeId: volunteerId,
                assigneeName: volunteerName,
                status: "Pending",
              });

              toast.success(
                dept === "Finance" && participant
                  ? `Cash collection for ${participant.name} assigned to ${volunteerName}`
                  : `Task assigned to ${volunteerName}`,
              );
              setModal(null);
            }}
          >
            <SelectField
              label="Department"
              name="department"
              options={["Finance", "Slaughter", "Processing", "Distribution"]}
              value={taskDepartment}
              onChange={setTaskDepartment}
            />

            {taskDepartment === "Finance" ? (
              <>
                <SelectField
                  label="Assign volunteer (Finance)"
                  options={
                    records.volunteers.filter((v) => v.department === "Finance").length > 0
                      ? records.volunteers.filter((v) => v.department === "Finance").map((v) => `${v.name} (${v.id})`)
                      : records.volunteers.map((v) => `${v.name} (${v.id})`)
                  }
                  value={taskVolunteer}
                  onChange={setTaskVolunteer}
                />
                <SelectField
                  label="Select participant for cash collection"
                  options={records.participants.map(
                    (p) =>
                      `${p.name} · ${p.id} · Due: ${money(
                        Number(p.amount) - verifiedBalance(records.payments, p.id),
                      )}`,
                  )}
                  value={taskParticipant}
                  onChange={setTaskParticipant}
                />
                <Field
                  label="Collection notes or ward (optional)"
                  name="reference"
                  placeholder="e.g. Ward 02 - East Lane"
                />
              </>
            ) : (
              <>
                <Field label="Task description" name="name" required />
                <SelectField
                  label="Assign volunteer"
                  options={records.volunteers.map((v) => `${v.name} (${v.id})`)}
                  value={taskVolunteer}
                  onChange={setTaskVolunteer}
                />
                <Field label="Animal / package reference" name="reference" required />
              </>
            )}

            <Button type="submit">Assign task</Button>
          </form>
        )}
        {modal === "archive" && (
          <>
            <p className="text-sm leading-relaxed text-muted-foreground">
              This marks the sample programme completed and closes registration in the public
              preview. Export your sample reports before closing.
            </p>
            <Button
              className="mt-6"
              onClick={() => {
                setProgrammeStatus("Completed");
                toast.success("Sample programme closed and archived");
                setModal(null);
              }}
            >
              Confirm programme closure
            </Button>
          </>
        )}
        {modal === "import" && (
          <div className="space-y-5">
            <p className="text-xs text-muted-foreground">
              Step {importStage + 1} of 4 ·{" "}
              {
                ["Upload CSV", "Map columns", "Validate & preview", "Import confirmation"][
                  importStage
                ]
              }
            </p>
            {importStage === 0 && (
              <>
                <input
                  aria-label="Household CSV upload"
                  type="file"
                  accept=".csv"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setImportFile(f);
                    const text = await f.text();
                    const lines = text
                      .trim()
                      .split(/\r?\n/)
                      .map((l) => l.split(","));
                    const headers = lines.shift() || [];
                    setImportHeaders(headers);
                    setImportRows(
                      lines.map((v, i) =>
                        normalizeRow({
                          id: `IMPORT-${i}`,
                          ...Object.fromEntries(headers.map((h, j) => [h, v[j] || ""])),
                        }),
                      ),
                    );
                    setImportMap(
                      Object.fromEntries(
                        ["name", "address", "contact", "members"].map((k) => [
                          k,
                          headers.includes(k) ? k : headers[0] || "",
                        ]),
                      ),
                    );
                    setImportStage(1);
                  }}
                  className="block w-full text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  CSV preview supported. Excel is represented by the same mapping journey; no server
                  upload takes place.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setImportHeaders(["name", "address", "contact", "members"]);
                    setImportMap({
                      name: "name",
                      address: "address",
                      contact: "contact",
                      members: "members",
                    });
                    setImportRows(
                      [
                        {
                          id: "IMPORT-1",
                          name: "Hassan Nizar",
                          address: "North Road",
                          contact: "Sample contact",
                          members: "4",
                        },
                        {
                          id: "IMPORT-2",
                          name: "Abdul Rahman",
                          address: "East Lane",
                          contact: "Sample contact",
                          members: "5",
                        },
                      ].map(normalizeRow),
                    );
                    setImportStage(1);
                  }}
                >
                  Use sample spreadsheet
                </Button>
              </>
            )}
            {importStage === 1 && (
              <>
                {["name", "address", "contact", "members"].map((k) => (
                  <SelectField
                    key={k}
                    label={k}
                    options={importHeaders}
                    value={importMap[k] || ""}
                    onChange={(v) => setImportMap((m) => ({ ...m, [k]: v }))}
                  />
                ))}
                <Button onClick={() => setImportStage(2)}>Validate records</Button>
              </>
            )}
            {importStage === 2 && (
              <>
                <DataTable
                  rows={importRows.map((r) =>
                    normalizeRow({
                      id: r.id,
                      name: r[importMap["name"] || ""] || "",
                      address: r[importMap["address"] || ""] || "",
                      status: records.households.some(
                        (h) => h.name === (r[importMap["name"] || ""] || ""),
                      )
                        ? "Duplicate warning"
                        : !(r[importMap["name"] || ""] || "")
                          ? "Missing name"
                          : "Valid",
                    }),
                  )}
                  columns={[
                    { key: "name", label: "Household head" },
                    { key: "address", label: "Address" },
                    { key: "status", label: "Validation" },
                  ]}
                />
                <p className="text-xs text-muted-foreground">
                  Duplicate or incomplete records are skipped. Importing households does not create
                  registrations.
                </p>
                <Button
                  onClick={async () => {
                    const validRows = importRows.filter(
                      (r) =>
                        (r[importMap["name"] || ""] || "") &&
                        !records.households.some(
                          (h) => h.name === (r[importMap["name"] || ""] || ""),
                        ),
                    );

                    // Call backend if a file was provided
                    if (importFile) {
                      try {
                        await householdsAdapter.importCsv(
                          profile?.orgId || "org_demo",
                          importFile,
                        );
                      } catch {
                        // Keep graceful fallback to client preview records
                      }
                    }

                    validRows.forEach((r, i) =>
                      add("households", {
                        id: `QBH-IMP-${records.households.length + i}`,
                        name: r[importMap["name"] || ""] || "",
                        address: r[importMap["address"] || ""] || "",
                        contact: r[importMap["contact"] || ""] || "",
                        members: r[importMap["members"] || ""] || "1",
                        status: "Active",
                      }),
                    );
                    setImportStage(3);
                    toast.success("Valid household records imported successfully");
                  }}
                >
                  Confirm import
                </Button>
              </>
            )}
            {importStage === 3 && (
              <>
                <Check className="size-10 text-cobalt" />
                <p className="font-semibold">Import complete.</p>
                <p className="text-sm text-muted-foreground">
                  Validated records appear in your household directory. No participation
                  registrations were created.
                </p>
                <Button onClick={() => setModal(null)}>View households</Button>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
