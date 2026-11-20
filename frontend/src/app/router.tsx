import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { HomePage } from "../pages/HomePage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { DesignSystemPage } from "../pages/DesignSystemPage";
import { ExperimentsPage } from "../pages/ExperimentsPage";
import { MethodologyPage } from "../pages/MethodologyPage";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "experiments", element: <ExperimentsPage /> },
      { path: "methodology", element: <MethodologyPage /> },
      { path: "design-system", element: <DesignSystemPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
