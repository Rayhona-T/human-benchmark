import { Link } from "react-router-dom";
import { usePageTitle } from "../app/usePageTitle";
import "./Page.css";

export function NotFoundPage() {
  usePageTitle("Page not found");
  return (
    <section className="not-found" aria-labelledby="not-found-title">
      <h1 id="not-found-title">Page not found</h1>
      <p>The requested page does not exist.</p>
      <Link to="/">Return home</Link>
    </section>
  );
}
