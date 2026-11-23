import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { HomePage } from "../pages/HomePage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { DesignSystemPage } from "../pages/DesignSystemPage";
import { ExperimentsPage } from "../pages/ExperimentsPage";
import { MethodologyPage } from "../pages/MethodologyPage";
import { StroopExperimentPage } from "../experiments/stroop/StroopExperimentPage";
import { FlankerExperimentPage } from "../experiments/flanker/FlankerExperimentPage";
import { observatoryEnabled } from "./devFeatures";

/**
 * Personal Observatory routes: development builds with a local test backend
 * configured ONLY. The literal `import.meta.env.DEV` test makes production
 * builds drop these routes and the lazily imported pages (devFeatures.ts).
 */
function observatoryRoutes(): RouteObject[] {
  if (!(import.meta.env.DEV && observatoryEnabled())) return [];
  return [
    {
      path: "observatory",
      lazy: async () => ({
        Component: (await import("../pages/observatory/ObservatoryPage"))
          .ObservatoryPage,
      }),
    },
    {
      path: "observatory/trends",
      lazy: async () => ({
        Component: (await import("../pages/observatory/TrendsPage")).TrendsPage,
      }),
    },
    {
      path: "observatory/sessions/:sessionId",
      lazy: async () => ({
        Component: (await import("../pages/observatory/SessionDetailPage"))
          .SessionDetailPage,
      }),
    },
  ];
}

export function createAppRoutes(): RouteObject[] {
  return [
    {
      element: <AppShell />,
      children: [
        { index: true, element: <HomePage /> },
        { path: "experiments", element: <ExperimentsPage /> },
        { path: "methodology", element: <MethodologyPage /> },
        { path: "experiments/stroop", element: <StroopExperimentPage /> },
        { path: "experiments/flanker", element: <FlankerExperimentPage /> },
        { path: "design-system", element: <DesignSystemPage /> },
        ...observatoryRoutes(),
        { path: "*", element: <NotFoundPage /> },
      ],
    },
  ];
}

export const router = createBrowserRouter(createAppRoutes());
