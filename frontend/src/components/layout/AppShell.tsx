import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { observatoryEnabled } from "../../app/devFeatures";
import "./AppShell.css";

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    const closeMenu = () => setMenuOpen(false);
    window.addEventListener("popstate", closeMenu);
    return () => window.removeEventListener("popstate", closeMenu);
  }, []);

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__header-inner">
          <Link
            className="app-shell__brand"
            to="/"
            aria-label="HUMAN BENCHMARK home"
            onClick={() => setMenuOpen(false)}
          >
            <span className="app-shell__brand-mark" aria-hidden="true">
              HB
            </span>
            <span>HUMAN BENCHMARK</span>
          </Link>

          <button
            ref={menuButtonRef}
            className="app-shell__menu-button"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="app-shell__menu-label">Menu</span>
            <span className="app-shell__menu-icon" aria-hidden="true">
              <span />
              <span />
            </span>
          </button>

          <nav
            id="primary-navigation"
            className={`app-shell__nav${menuOpen ? " app-shell__nav--open" : ""}`}
            aria-label="Primary navigation"
          >
            <NavLink
              className={({ isActive }) =>
                `app-shell__nav-link${isActive ? " app-shell__nav-link--active" : ""}`
              }
              to="/"
              end
              onClick={() => setMenuOpen(false)}
            >
              Home
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                `app-shell__nav-link${isActive ? " app-shell__nav-link--active" : ""}`
              }
              to="/experiments"
              onClick={() => setMenuOpen(false)}
            >
              Experiments
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                `app-shell__nav-link${isActive ? " app-shell__nav-link--active" : ""}`
              }
              to="/methodology"
              onClick={() => setMenuOpen(false)}
            >
              Methodology
            </NavLink>
            {/* Development builds with a local test backend only; removed
                from production builds (app/devFeatures.ts). */}
            {import.meta.env.DEV && observatoryEnabled() ? (
              <NavLink
                className={({ isActive }) =>
                  `app-shell__nav-link${isActive ? " app-shell__nav-link--active" : ""}`
                }
                to="/observatory"
                onClick={() => setMenuOpen(false)}
              >
                Observatory
              </NavLink>
            ) : null}
          </nav>
        </div>
      </header>

      <main className="app-shell__main">
        <Outlet />
      </main>

      <footer className="app-shell__footer">
        <div className="app-shell__footer-inner">
          <p>Educational, research-inspired cognitive experiments.</p>
          <Link to="/methodology">Scientific methodology</Link>
        </div>
      </footer>
    </div>
  );
}
