import { useState, type ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

/**
 * Renders `children` inside an in-memory DATA router, like the app's
 * createBrowserRouter. Experiment pages need one: they block in-app
 * navigation while a session is active (useBlocker, Task 10.4), which plain
 * <MemoryRouter> does not support. Every path renders `children`.
 */
export function TestRouter({ children }: { children: ReactNode }) {
  const [router] = useState(() =>
    createMemoryRouter([{ path: "*", element: children }]),
  );
  return <RouterProvider router={router} />;
}
