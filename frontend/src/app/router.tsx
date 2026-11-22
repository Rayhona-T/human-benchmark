import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { HomePage } from "../pages/HomePage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { DesignSystemPage } from "../pages/DesignSystemPage";
import { ExperimentsPage } from "../pages/ExperimentsPage";
import { MethodologyPage } from "../pages/MethodologyPage";
import { StroopExperimentPage } from "../experiments/stroop/StroopExperimentPage";
import { FlankerExperimentPage } from "../experiments/flanker/FlankerExperimentPage";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "experiments", element: <ExperimentsPage /> },
      { path: "methodology", element: <MethodologyPage /> },
      { path: "experiments/stroop", element: <StroopExperimentPage /> },
      { path: "experiments/flanker", element: <FlankerExperimentPage /> },
      { path: "design-system", element: <DesignSystemPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
