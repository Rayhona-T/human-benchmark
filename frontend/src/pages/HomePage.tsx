import { Link } from "react-router-dom";
import { usePageTitle } from "../app/usePageTitle";
import { Card } from "../components/ui/Card";
import "./Page.css";

export function HomePage() {
  usePageTitle("Home");

  return (
    <div className="page page--home">
      <section className="page-hero" aria-labelledby="home-title">
        <p className="page-eyebrow">Educational cognitive science</p>
        <h1 id="home-title">Observe a task. Understand its limits.</h1>
        <p className="page-hero__summary">
          HUMAN BENCHMARK is a research-inspired platform for exploring how
          cognitive tasks are designed, measured, and interpreted.
        </p>
        <div className="page-actions">
          <Link className="page-primary-action" to="/experiments">
            Explore experiments
          </Link>
          <Link className="text-link" to="/methodology">
            Read methodology
          </Link>
        </div>
      </section>

      <section className="page-section" aria-labelledby="purpose-title">
        <h2 id="purpose-title">Designed for clarity</h2>
        <div className="page-card-grid">
          <Card>
            <p className="page-card-label">01 · Context</p>
            <h3>Transparent methods</h3>
            <p>
              Each task should explain its purpose, conditions, measurements,
              and limits alongside the experience.
            </p>
          </Card>
          <Card>
            <p className="page-card-label">02 · Interpretation</p>
            <h3>Measured with care</h3>
            <p>
              Session observations describe this task and device context. They
              do not establish diagnosis or general ability.
            </p>
          </Card>
          <Card>
            <p className="page-card-label">03 · Privacy</p>
            <h3>Guest-first participation</h3>
            <p>
              The planned MVP minimizes unnecessary data and makes collection
              and export behavior explicit.
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
}
