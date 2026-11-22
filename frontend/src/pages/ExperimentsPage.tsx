import { usePageTitle } from "../app/usePageTitle";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import "./Page.css";
import { Link } from "react-router-dom";

export function ExperimentsPage() {
  usePageTitle("Experiments");

  return (
    <div className="page">
      <header className="page-header">
        <p className="page-eyebrow">Experiment catalogue</p>
        <h1>Experiments</h1>
        <p className="page-intro">
          The initial catalogue includes the Stroop and Flanker tasks. Both are
          educational, browser-based adaptations of classic experiments.
        </p>
      </header>

      <section
        className="experiment-list"
        aria-label="Available experiment types"
      >
        <Card elevated>
          <div className="experiment-card__header">
            <div>
              <p className="page-card-label">Color-word task</p>
              <h2>Stroop Effect</h2>
            </div>
            <Badge tone="success">Available for practice</Badge>
          </div>
          <p>
            Explore how responses may change when a word meaning conflicts with
            the color used to display it.
          </p>
          <p className="experiment-card__status">
            Protocol approved. Participant experience available.
          </p>
          <Link className="experiment-card__action" to="/experiments/stroop">
            Start Stroop
          </Link>
        </Card>

        <Card elevated>
          <div className="experiment-card__header">
            <div>
              <p className="page-card-label">Arrow array task</p>
              <h2>Flanker Effect</h2>
            </div>
            <Badge tone="success">Available for practice</Badge>
          </div>
          <p>
            Explore how responses to a central arrow may vary with surrounding
            congruent, incongruent, or neutral symbols.
          </p>
          <p className="experiment-card__status">
            Protocol approved. Participant experience available.
          </p>
          <Link className="experiment-card__action" to="/experiments/flanker">
            Start Flanker
          </Link>
        </Card>
      </section>

      <section className="page-note" aria-label="Interpretation notice">
        <h2>What this catalogue does not provide</h2>
        <p>
          These entries are not playable assessments, performance rankings, or
          medical or psychological evaluations.
        </p>
      </section>
    </div>
  );
}
