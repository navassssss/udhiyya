import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  Navigate,
  Link,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider } from "./services/auth";
import { DemoStore } from "./components/app/DemoStore";
import { ParticipantSession } from "./components/app/ParticipantSession";
import { PortalShell } from "./components/app/PortalShell";
import { SuperAdminWorkspace } from "./components/app/SuperAdminWorkspace";
import { AdminWorkspace } from "./components/app/AdminWorkspace";
import { VolunteerWorkspace } from "./components/app/VolunteerWorkspace";
import { ParticipantWorkspace } from "./components/app/ParticipantWorkspace";
import { ProgrammePage } from "./components/app/ProgrammePage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { ConfirmEmailPage } from "./pages/ConfirmEmailPage";
import { ProtectedRoute } from "./components/common/ProtectedRoute";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DemoStore>
          <ParticipantSession>
            <Outlet />
            <Toaster position="top-right" richColors />
          </ParticipantSession>
        </DemoStore>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

const rootRoute = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

// ─── Public Routes (PUB02–PUB08) ──────────────────────────────────────────

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LandingPage,
});

const programmeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/programme",
  component: () => <ProgrammePage section="programme" />,
});

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/about",
  component: () => <ProgrammePage section="about" />,
});

const processRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/process",
  component: () => <ProgrammePage section="process" />,
});

const guidelinesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/guidelines",
  component: () => <ProgrammePage section="guidelines" />,
});

const faqRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/faq",
  component: () => <ProgrammePage section="faq" />,
});

const contactRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/contact",
  component: () => <ProgrammePage section="contact" />,
});

const announcementsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/announcements",
  component: () => <ProgrammePage section="announcements" />,
});

const distributionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/distribution",
  component: () => <ProgrammePage section="distribution" />,
});

// ─── Auth Routes ────────────────────────────────────────────────────────────

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: () => <LoginPage initialMode="signin" />,
});

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/signup",
  component: () => <LoginPage initialMode="signup" />,
});

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/forgot-password",
  component: () => <LoginPage initialMode="forgot" />,
});

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reset-password",
  component: ResetPasswordPage,
});

const passwordChangeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/password-change",
  component: ResetPasswordPage,
});

const confirmEmailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/confirm-email",
  component: ConfirmEmailPage,
});

// ─── Super Admin Routes (SA02–SA04) ─────────────────────────────────────────

const superAdminIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/super-admin",
  component: () => (
    <Navigate to="/super-admin/$section" params={{ section: "organisations" }} replace />
  ),
});

const superAdminSectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/super-admin/$section",
  component: function SuperAdminSection() {
    const { section } = superAdminSectionRoute.useParams();
    return (
      <ProtectedRoute allowedRoles={["super_admin"]}>
        <PortalShell kind="super-admin" section={section}>
          <SuperAdminWorkspace key={section} section={section} />
        </PortalShell>
      </ProtectedRoute>
    );
  },
});

const superAdminOrgDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/super-admin/organisations/$id",
  component: function SuperAdminOrgDetail() {
    const { id } = superAdminOrgDetailRoute.useParams();
    return (
      <ProtectedRoute allowedRoles={["super_admin"]}>
        <PortalShell kind="super-admin" section="organisations">
          <SuperAdminWorkspace key={id} section="details" organisationId={id} />
        </PortalShell>
      </ProtectedRoute>
    );
  },
});

// ─── Committee Admin Routes (ADM02) ─────────────────────────────────────────

const adminIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: () => (
    <Navigate to="/admin/$section" params={{ section: "dashboard" }} replace />
  ),
});

const adminSectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/$section",
  component: function AdminSection() {
    const { section } = adminSectionRoute.useParams();
    return (
      <ProtectedRoute allowedRoles={["committee_admin", "super_admin"]}>
        <PortalShell kind="admin" section={section}>
          <AdminWorkspace key={section} section={section} />
        </PortalShell>
      </ProtectedRoute>
    );
  },
});

const adminRegistrationDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/registrations/$id",
  component: function AdminRegDetail() {
    const { id } = adminRegistrationDetailRoute.useParams();
    return (
      <ProtectedRoute allowedRoles={["committee_admin", "super_admin"]}>
        <PortalShell kind="admin" section="participants">
          <AdminWorkspace key={id} section="participants" initialSelectedId={id} />
        </PortalShell>
      </ProtectedRoute>
    );
  },
});

// ─── Volunteer Routes (VOL01–VOL06) ─────────────────────────────────────────

const volunteerIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/volunteer",
  component: () => (
    <Navigate to="/volunteer/$section" params={{ section: "home" }} replace />
  ),
});

const volunteerSectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/volunteer/$section",
  component: function VolunteerSection() {
    const { section } = volunteerSectionRoute.useParams();
    return (
      <ProtectedRoute allowedRoles={["volunteer", "committee_admin", "super_admin"]}>
        <PortalShell kind="volunteer" section={section}>
          <VolunteerWorkspace key={section} section={section} />
        </PortalShell>
      </ProtectedRoute>
    );
  },
});

// ─── Legacy Beneficiary Route Redirects ────────────────────────────────────

const legacyBeneficiaryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/beneficiary",
  component: () => <Navigate to="/login" replace />,
});

const legacyBeneficiarySectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/beneficiary/$section",
  component: () => <Navigate to="/login" replace />,
});

// ─── Participant Routes (PAR01–PAR08) ───────────────────────────────────────

const participantIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/participant",
  component: () => (
    <Navigate to="/participant/$section" params={{ section: "overview" }} replace />
  ),
});

const participantSectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/participant/$section",
  component: function ParticipantSection() {
    const { section } = participantSectionRoute.useParams();
    return (
      <ProtectedRoute allowedRoles={["participant", "committee_admin", "super_admin"]}>
        <PortalShell kind="participant" section={section}>
          <ParticipantWorkspace key={section} section={section} />
        </PortalShell>
      </ProtectedRoute>
    );
  },
});

// Legacy / alias dashboard route for participant space
const dashboardIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: () => (
    <Navigate to="/participant/$section" params={{ section: "overview" }} replace />
  ),
});

const dashboardSectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard/$section",
  component: function DashboardSection() {
    const { section } = dashboardSectionRoute.useParams();
    return (
      <Navigate to="/participant/$section" params={{ section }} replace />
    );
  },
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  programmeRoute,
  aboutRoute,
  processRoute,
  guidelinesRoute,
  faqRoute,
  contactRoute,
  announcementsRoute,
  distributionRoute,
  loginRoute,
  signupRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  passwordChangeRoute,
  confirmEmailRoute,
  dashboardIndexRoute,
  dashboardSectionRoute,
  volunteerIndexRoute,
  volunteerSectionRoute,
  legacyBeneficiaryRoute,
  legacyBeneficiarySectionRoute,
  participantIndexRoute,
  participantSectionRoute,
  adminRegistrationDetailRoute,
  superAdminIndexRoute,
  superAdminSectionRoute,
  superAdminOrgDetailRoute,
  adminIndexRoute,
  adminSectionRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
