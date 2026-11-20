import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/misc";
import { AgentListPage } from "@/features/agents/AgentListPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequireLogin } from "@/features/auth/RequireLogin";
import { OverviewPage } from "@/features/overview/OverviewPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { RouteErrorPage } from "@/pages/RouteErrorPage";

// Heavier screens load on demand (React Flow, charts, editors).
const AgentEditorPage = lazy(() =>
  import("@/features/agents/editor/AgentEditorPage").then((m) => ({
    default: m.AgentEditorPage,
  })),
);
const GraphEditorPage = lazy(() =>
  import("@/features/graph/GraphEditorPage").then((m) => ({
    default: m.GraphEditorPage,
  })),
);
const CallsPage = lazy(() =>
  import("@/features/calls/CallsPage").then((m) => ({ default: m.CallsPage })),
);
const KnowledgeBasePage = lazy(() =>
  import("@/features/knowledge-base/KnowledgeBasePage").then((m) => ({
    default: m.KnowledgeBasePage,
  })),
);
const SettingsPage = lazy(() =>
  import("@/features/settings/SettingsPage").then((m) => ({
    default: m.SettingsPage,
  })),
);

const page = (node: ReactNode) => (
  <Suspense
    fallback={
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    }
  >
    {node}
  </Suspense>
);

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage />, errorElement: <RouteErrorPage /> },
  {
    // Every dashboard page needs a session (TRACKER F7).
    element: <RequireLogin />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <AppLayout />,
        // A crash inside a page keeps the sidebar and shows a friendly message.
        errorElement: <RouteErrorPage />,
        children: [
          {
            errorElement: <RouteErrorPage />,
            children: [
              { path: "/", element: <OverviewPage /> },
              { path: "/agents", element: <AgentListPage kind="simple" /> },
              { path: "/agents/:id", element: page(<AgentEditorPage />) },
              { path: "/graphs", element: <AgentListPage kind="graph" /> },
              { path: "/graphs/:id", element: page(<GraphEditorPage />) },
              { path: "/knowledge-base", element: page(<KnowledgeBasePage />) },
              { path: "/calls", element: page(<CallsPage />) },
              { path: "/settings", element: page(<SettingsPage />) },
              { path: "*", element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
