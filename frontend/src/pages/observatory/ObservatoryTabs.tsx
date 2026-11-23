import { NavLink } from "react-router-dom";

/** Switches between the Observatory's two views. */
export function ObservatoryTabs() {
  const tab = ({ isActive }: { isActive: boolean }) =>
    `observatory-tabs__link${isActive ? " observatory-tabs__link--active" : ""}`;
  return (
    <nav className="observatory-tabs" aria-label="Observatory views">
      <NavLink to="/observatory" end className={tab}>
        History
      </NavLink>
      <NavLink to="/observatory/trends" className={tab}>
        Trends
      </NavLink>
    </nav>
  );
}
