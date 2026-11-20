import { usePageTitle } from "../app/usePageTitle";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import "./Page.css";

export function ExperimentsPage() {
  usePageTitle("Experiments");

  return (
    <div className="page">
      <header className="page-header">
        <p className="page-eyebrow">Experiment catalogue</p>
        <h1>Experiments</h1>
        <p className="page-intro">
          The initial catalogue consists of two research-inspired task families.
          Both remain unavailable until their implementation cycles are approved
          and completed.
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
            <Badge tone="warning">Upcoming</Badge>
          </div>
          <p>
            Explore how responses may change when a word meaning conflicts with
            the color used to display it.
          </p>
          <p className="experiment-card__status">
            Protocol approved. Experiment implementation is not started.
          </p>
        </Card>

        <Card elevated>
          <div className="experiment-card__header">
            <div>
              <p className="page-card-label">Arrow array task</p>
              <h2>Flanker Effect</h2>
            </div>
            <Badge tone="warning">Upcoming</Badge>
          </div>
          <p>
            Explore how responses to a central arrow may vary with surrounding
            congruent, incongruent, or neutral symbols.
          </p>
          <p className="experiment-card__status">
            Scientific protocol is awaiting human review. Experiment
            implementation is not started.
          </p>
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
