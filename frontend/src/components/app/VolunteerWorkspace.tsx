import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Check, ArrowRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useDemo } from "./DemoStore";
import { PageTitle, Metrics, DataTable, Modal, Status, SelectField, Timeline } from "./WorkflowUI";
import { Button, btn } from "./Btn";
import { Field } from "./AuthShell";
import { money, verifiedBalance, type Row } from "@/lib/workflow";
import { operationsAdapter, distributionAdapter } from "@/services/api";
export function VolunteerWorkspace({ section }: { section: string }) {
  const { account, records, update, add } = useDemo();
  const dept = account?.department || "Processing";
  const [modal, setModal] = useState<string | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [search, setSearch] = useState("");
  const [pathway, setPathway] = useState("All pathways");
  const [handover, setHandover] = useState(false);
  const tasks = records.tasks.filter((t) => t.department === dept);
  const schedule = records.scheduling.filter((s) => s.department === dept);
  const notices = records.announcements.filter(
    (a) => a.status === "Published" && ["All users", "Volunteers", dept].includes(a.audience),
  );
  const assignedAnimals = records.animals.filter((a) =>
    dept === "Slaughter" ? a.id === "AN-001" : a.id === "AN-003",
  );
  function open(kind: string, row?: Row) {
    setSelected(row || null);
    setHandover(false);
    setModal(kind);
  }
  function taskProgress(r: Row) {
    const status = r.status === "Pending" ? "In progress" : "Completed";
    update("tasks", r.id, { status });
    const backendStatus: "in_progress" | "completed" =
      status === "Completed" ? "completed" : "in_progress";
    operationsAdapter
      .updateTaskProgress("org_demo", "2027", r.id, backendStatus)
      .catch(() => {});
    toast.success(`Task ${status.toLowerCase()}`);
  }
  return (
    <>
      <PageTitle
        eyebrow={`${dept} department · Team 02`}
        title={
          section === "home"
            ? `Assalamu Alaikum, ${account?.name.split(" ")[0]}.`
            : (
                {
                  tasks: "Your tasks, in focus.",
                  department: `${dept} workspace`,
                  schedule: "Today’s schedule & your team",
                  issues: "Report an operational issue",
                  updates: "Your updates & profile",
                } as Record<string, string>
              )[section] || "Volunteer workspace"
        }
        description="Your assigned work. Your team. One shared purpose."
        actions={
          <Button variant="outline" size="sm" onClick={() => open("issue")}>
            <AlertCircle className="size-4" />
            Report issue
          </Button>
        }
      />
      {section === "home" && (
        <>
          <Metrics
            items={[
              { label: "Assigned tasks", value: tasks.length },
              {
                label: "Completed tasks",
                value: tasks.filter((t) => t.status === "Completed").length,
              },
              {
                label: "Pending tasks",
                value: tasks.filter((t) => t.status !== "Completed").length,
              },
              { label: "Updates", value: notices.length },
            ]}
          />
          <div className="mb-8 flex flex-wrap items-center justify-between gap-5 rounded-lg bg-accent p-5">
            <div>
              <p className="text-xs text-cobalt">YOUR NEXT ACTIVITY</p>
              <h2 className="mt-2 text-xl font-bold">
                {schedule[0]?.activity || `${dept} team activity`}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {schedule[0]?.time || "Awaiting schedule"} ·{" "}
                {schedule[0]?.location || "Location to be confirmed"} · Team 02
              </p>
            </div>
            <Link
              to="/volunteer/$section"
              params={{ section: "department" }}
              className={btn({ size: "sm" })}
            >
              Open assigned work
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="space-y-6">
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">My pending tasks</h2>
                <Link
                  to="/volunteer/$section"
                  params={{ section: "tasks" }}
                  className="text-xs text-cobalt hover:underline font-medium"
                >
                  View all tasks →
                </Link>
              </div>
              <DataTable
                rows={tasks.filter((t) => t.status !== "Completed")}
                columns={[
                  { key: "name", label: "Task" },
                  { key: "status", label: "Progress" },
                ]}
                actions={(r) => (
                  <Button variant="ghost" size="sm" onClick={() => taskProgress(r)}>
                    {r.status === "Pending" ? "Start" : "Complete"}
                  </Button>
                )}
              />
            </section>
          </div>
        </>
      )}
      {section === "tasks" && (
        <DataTable
          rows={tasks}
          columns={[
            { key: "id", label: "Task ID" },
            { key: "name", label: "Assigned task" },
            { key: "reference", label: "Reference" },
            { key: "status", label: "Progress" },
          ]}
          onOpen={(r) => open("task", r)}
          actions={(r) =>
            r.status !== "Completed" && (
              <Button variant="outline" size="sm" onClick={() => taskProgress(r)}>
                {r.status === "Pending" ? "Start task" : "Complete task"}
              </Button>
            )
          }
        />
      )}
      {section === "department" && (
        <>
          {(dept === "Slaughter" || dept === "Processing") && (
            <>
              <Metrics
                items={[
                  { label: "Assigned animals", value: assignedAnimals.length },
                  {
                    label: dept === "Slaughter" ? "Awaiting slaughter" : "Awaiting processing",
                    value: assignedAnimals.filter((a) => !a.stage.includes("completed")).length,
                  },
                  {
                    label: "Completed activities",
                    value: assignedAnimals.filter((a) => a.stage.includes("completed")).length,
                  },
                  {
                    label: "Actual weight recorded",
                    value: `${assignedAnimals.reduce((n, a) => n + Number(a.weight), 0)} kg`,
                  },
                ]}
              />
              <DataTable
                rows={assignedAnimals}
                columns={[
                  { key: "id", label: "Animal ID" },
                  { key: "type", label: "Type" },
                  { key: "group", label: "Group" },
                  { key: "stage", label: "Stage" },
                  { key: "weight", label: "Actual kg" },
                ]}
                onOpen={(r) => open("animal", r)}
              />
            </>
          )}
          {dept === "Distribution" && (
            <>
              <SelectField
                label="Assigned queue"
                options={["All pathways", "Participant", "Public beneficiary"]}
                value={pathway}
                onChange={setPathway}
              />
              <div className="mt-6">
                <DataTable
                  rows={records.distribution.filter(
                    (r) => pathway === "All pathways" || r.pathway === pathway,
                  )}
                  columns={[
                    { key: "id", label: "Package" },
                    { key: "recipient", label: "Recipient reference" },
                    { key: "pathway", label: "Pathway" },
                    { key: "quantity", label: "Quantity kg" },
                    { key: "status", label: "Status" },
                  ]}
                  search={search}
                  onSearch={setSearch}
                  onOpen={(r) => open("package", r)}
                />
              </div>
              <p className="mt-5 text-xs text-muted-foreground">
                Only assigned recipient references are shown. Confirm collection only after actual
                handover.
              </p>
            </>
          )}
          {dept === "Finance" && (
            <>
              {(() => {
                const finTasks = records.tasks.filter((t) => t.department === "Finance");
                const assignedParticipantIds = finTasks.map((t) => t.reference || t.resourceId);
                const assigned = records.participants.filter(
                  (p) => assignedParticipantIds.includes(p.id) || p.id === "QOS-2027-001",
                );
                const mySubmissions = records.payments.filter((p) => p.method === "Cash");

                return (
                  <>
                    <Metrics
                      items={[
                        { label: "Assigned collections", value: assigned.length },
                        {
                          label: "Submitted collections",
                          value: mySubmissions.length,
                        },
                        {
                          label: "Pending verification",
                          value: mySubmissions.filter(
                            (p) => p.status === "Pending verification",
                          ).length,
                        },
                        {
                          label: "Verified collections",
                          value: mySubmissions.filter((p) => p.status === "Verified").length,
                        },
                      ]}
                    />
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-lg font-bold">Assigned participant collections</h2>
                      <span className="text-xs text-muted-foreground">
                        Authorised by committee · Record cash received on the ground
                      </span>
                    </div>
                    {assigned.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                        No share collections assigned yet by the committee.
                      </p>
                    ) : (
                      <DataTable
                        rows={assigned}
                        columns={[
                          { key: "id", label: "Reference" },
                          { key: "name", label: "Participant" },
                          { key: "amount", label: "Total contribution" },
                        ]}
                        search={search}
                        onSearch={setSearch}
                        actions={(r) => {
                          const verified = verifiedBalance(records.payments, r.id);
                          const due = Number(r.amount) - verified;
                          const isFullyPaid = due <= 0;
                          return (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                Due: {money(Math.max(0, due))}
                              </span>
                              <Button
                                variant={isFullyPaid ? "outline" : "ink"}
                                size="sm"
                                disabled={isFullyPaid}
                                onClick={() => open("cash", r)}
                              >
                                {isFullyPaid ? "Fully paid" : "Record cash"}
                              </Button>
                            </div>
                          );
                        }}
                      />
                    )}
                    <h2 className="mb-5 mt-8 text-lg font-bold">My collection history</h2>
                    <DataTable
                      rows={mySubmissions}
                      columns={[
                        { key: "id", label: "Submission" },
                        { key: "name", label: "Participant" },
                        { key: "amount", label: "Amount" },
                        { key: "date", label: "Date" },
                        { key: "status", label: "Verification" },
                      ]}
                    />
                    <div className="mt-5 rounded-lg border border-border bg-muted/30 p-4">
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        <strong className="text-foreground">Separation of duties:</strong> Volunteer cash
                        collection is a submission, not payment verification. Submitted collections
                        remain in the audit queue as <em>Pending verification</em> until an authorised
                        finance committee member approves them and verifies physical cash. Volunteers
                        cannot verify their own submissions.
                      </p>
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </>
      )}
      {section === "schedule" && (
        <>
          <DataTable
            rows={schedule}
            columns={[
              { key: "activity", label: "Activity" },
              { key: "time", label: "Time" },
              { key: "location", label: "Location" },
              { key: "status", label: "Schedule" },
            ]}
          />
          <h2 className="mb-4 mt-8 text-xl font-bold">Your team</h2>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="border-t border-border pt-4">
              <p className="font-semibold">{account?.name}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {dept} · Team 02 · Assigned volunteer
              </p>
            </div>
            <div className="border-t border-border pt-4">
              <p className="font-semibold">Amina Rahman</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Committee coordinator · Sample team contact
              </p>
            </div>
          </div>
        </>
      )}
      {section === "issues" && (
        <>
          <Button className="mb-6" onClick={() => open("issue")}>
            <Plus className="size-4" />
            New issue
          </Button>
          <DataTable
            rows={records.issues.filter((i) => i.department === dept)}
            columns={[
              { key: "id", label: "Issue ID" },
              { key: "category", label: "Category" },
              { key: "description", label: "Description" },
              { key: "reference", label: "Reference" },
              { key: "status", label: "Status" },
            ]}
          />
        </>
      )}
      {section === "updates" && (
        <div className="grid gap-10 lg:grid-cols-2">
          <section>
            <h2 className="mb-4 text-xl font-bold">Committee announcements</h2>
            {notices.map((a) => (
              <article key={a.id} className="border-b border-border py-4">
                <p className="text-xs text-cobalt">
                  {a.date} · {a.audience}
                </p>
                <h3 className="mt-2 font-semibold">{a.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.message}</p>
              </article>
            ))}
          </section>
          <section>
            <h2 className="mb-5 text-xl font-bold">Your profile</h2>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                toast.success("Sample profile preferences saved for this view.");
              }}
            >
              <Field label="Name" defaultValue={account?.name} />
              <Field label="Department · committee-assigned" value={dept} readOnly />
              <Field label="Team" value="Team 02" readOnly />
              <Field label="Contact" placeholder="Your contact details" />
              <Button>Save preferences</Button>
            </form>
          </section>
        </div>
      )}
      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={
          modal === "issue"
            ? "Report an issue"
            : modal === "cash"
              ? "Record cash received"
              : modal === "package"
                ? "Assigned package"
                : modal === "task"
                  ? "Task progress"
                  : "Assigned animal activity"
        }
      >
        {modal === "issue" && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              add("issues", {
                id: `ISS-${records.issues.length + 1}`,
                category: String(d.get("category")),
                description: String(d.get("description")),
                reference: String(d.get("reference")),
                department: dept,
                reportedBy: account?.name || "",
                date: new Date().toISOString(),
                status: "Open",
              });
              operationsAdapter
                .reportIssue("org_demo", "2027", {
                  category: String(d.get("category")),
                  description: String(d.get("description")),
                  reference: String(d.get("reference")),
                  department: dept,
                })
                .catch(() => {});
              toast.success("Issue submitted to committee monitoring queue");
              setModal(null);
            }}
          >
            <SelectField
              label="Issue category"
              name="category"
              options={[
                "Assigned animal unavailable",
                "Processing delay",
                "Packaging shortage",
                "Distribution discrepancy",
                "Payment collection issue",
                "Other",
              ]}
            />
            <Field label="Related animal / task / package reference" name="reference" required />
            <label className="block text-sm">
              Description
              <textarea
                name="description"
                required
                className="mt-2 min-h-24 w-full rounded-lg border border-border bg-card p-3"
              />
            </label>
            <Button>Submit issue</Button>
          </form>
        )}
        {modal === "task" && selected && (
          <>
            <h2 className="text-lg font-bold">{selected.name}</h2>
            <p className="my-3 text-sm text-muted-foreground">
              {selected.reference} · Assigned by committee
            </p>
            <Timeline
              steps={["Pending", "In progress", "Completed"]}
              active={
                selected.status === "Completed" ? 2 : selected.status === "In progress" ? 1 : 0
              }
            />
            {selected.status !== "Completed" && (
              <Button
                className="mt-5"
                onClick={() => {
                  taskProgress(selected);
                  setModal(null);
                }}
              >
                Update task progress
              </Button>
            )}
          </>
        )}
        {modal === "animal" && selected && (
          <>
            <p className="text-xl font-bold">
              {selected.id} · {selected.type}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Group {selected.group} · Team 02</p>
            <div className="my-5">
              <Status>{selected.stage}</Status>
            </div>
            {dept === "Slaughter" ? (
              <Button
                disabled={selected.stage === "Slaughter completed"}
                onClick={() => {
                  update("animals", selected.id, { stage: "Slaughter completed" });
                  operationsAdapter
                    .updateOperationProgress("org_demo", "2027", selected.id, {
                      status: "completed",
                      stage: "slaughter_completed",
                      note: "Slaughter confirmed by ground volunteer",
                    })
                    .catch(() => {});
                  toast.success("Slaughter completed. Processing stage is ready.");
                  setModal(null);
                }}
              >
                Confirm slaughter completed
              </Button>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget);
                  const stageVal = String(d.get("stage"));
                  const weightVal = String(d.get("weight"));
                  update("animals", selected.id, {
                    stage: stageVal,
                    weight: weightVal,
                  });
                  operationsAdapter
                    .updateOperationProgress("org_demo", "2027", selected.id, {
                      status: "in_progress",
                      stage: stageVal.toLowerCase().replace(/\s+/g, "_"),
                      measuredGrams: Math.round(Number(weightVal) * 1000),
                    })
                    .catch(() => {});
                  toast.success(
                    "Actual processed quantity and stage recorded. Distribution ledger updated.",
                  );
                  setModal(null);
                }}
              >
                <SelectField
                  label="Processing stage"
                  name="stage"
                  options={[
                    "Processing in progress",
                    "Cutting completed",
                    "Weighing completed",
                    "Packaging in progress",
                    "Processing completed",
                  ]}
                />
                <Field
                  label="Actual processed quantity (kg)"
                  name="weight"
                  type="number"
                  min={0}
                  step="0.1"
                  defaultValue={selected.weight}
                  required
                />
                <Field label="Packages prepared" type="number" min={0} />
                <Button>Save processing progress</Button>
                <p className="text-xs text-muted-foreground">
                  Record actual measured quantities. No fixed animal yield is assumed.
                </p>
              </form>
            )}
          </>
        )}
        {modal === "cash" && selected && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              const matchingTask = records.tasks.find(
                (t) =>
                  t.department === "Finance" &&
                  (t.reference === selected.id || t.resourceId === selected.id),
              );
              const assignmentId = matchingTask?.id || "TSK-005";
              const amount = Number(d.get("amount"));
              const date = String(d.get("date"));
              const notes = String(d.get("notes") || "");

              operationsAdapter
                .submitCash("org_demo", "2027", {
                  assignmentId,
                  amount,
                  receivedAt: new Date(date).toISOString(),
                  reference: notes,
                })
                .catch(() => {});

              add("payments", {
                id: `PAY-${records.payments.length + 1}`,
                participant: selected.id,
                name: selected.name,
                amount: String(amount),
                method: "Cash",
                date,
                notes,
                status: "Pending verification",
              });

              if (matchingTask) {
                update("tasks", matchingTask.id, { status: "In progress" });
              }

              toast.success("Cash collection submitted. Awaiting finance committee verification.");
              setModal(null);
            }}
          >
            <p className="font-semibold">{selected.name}</p>
            <p className="text-sm text-muted-foreground">
              Contribution due:{" "}
              {money(
                Number(selected.amount) -
                  records.payments
                    .filter((p) => p.participant === selected.id && p.status === "Verified")
                    .reduce((n, p) => n + Number(p.amount), 0),
              )}
            </p>
            <Field label="Cash received" name="amount" type="number" min={1} required />
            <Field label="Transaction date" name="date" type="date" required />
            <Field label="Notes or reference" name="notes" />
            <Button>Submit cash collection</Button>
          </form>
        )}
        {modal === "package" && selected && (
          <>
            <p className="font-semibold">
              {selected.id} · {selected.recipient}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {selected.quantity} kg · {selected.location} · {selected.time}
            </p>
            <div className="my-5">
              <Status>{selected.status}</Status>
            </div>
            {selected.status === "Pending allocation" ? (
              <p className="text-sm text-muted-foreground">
                Committee allocation is required before this package can be prepared.
              </p>
            ) : selected.status === "Allocated" ? (
              <Button
                onClick={() => {
                  update("distribution", selected.id, { status: "Ready" });
                  distributionAdapter
                    .transition("org_demo", "2027", selected.id, { action: "pack" })
                    .catch(() => {});
                  toast.success("Package marked ready");
                  setModal(null);
                }}
              >
                Mark package ready
              </Button>
            ) : selected.status === "Ready" ? (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const ref = String(new FormData(e.currentTarget).get("reference"));
                  if (ref !== selected.recipient) {
                    toast.error("Collection reference does not match this package.");
                    return;
                  }
                  if (!handover) return;
                  update("distribution", selected.id, { status: "Collected" });
                  distributionAdapter
                    .volunteerHandoff("org_demo", "2027", selected.id, {
                      outcome: "collected",
                      recipientProof: ref,
                    })
                    .catch(() => {
                      distributionAdapter
                        .transition("org_demo", "2027", selected.id, { action: "confirm" })
                        .catch(() => {});
                    });
                  toast.success("Collection confirmed after verified handover");
                  setModal(null);
                }}
              >
                <Field label="Recipient collection reference" name="reference" required />
                <label className="flex items-start gap-2 text-sm">
                  <input
                    required
                    type="checkbox"
                    checked={handover}
                    onChange={(e) => setHandover(e.target.checked)}
                    className="mt-1"
                  />
                  I verified the reference and handed over the package.
                </label>
                <Button>Confirm collection</Button>
              </form>
            ) : (
              <p className="text-sm text-cobalt">Collection has been recorded.</p>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
