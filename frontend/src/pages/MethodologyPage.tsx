import { usePageTitle } from "../app/usePageTitle";
import { Card } from "../components/ui/Card";
import "./Page.css";

export function MethodologyPage() {
  usePageTitle("Methodology");

  return (
    <div className="page">
      <header className="page-header">
        <p className="page-eyebrow">Scientific methodology</p>
        <h1>How to interpret the platform</h1>
        <p className="page-intro">
          HUMAN BENCHMARK is educational and research-inspired. It does not
          provide diagnostic, clinical, or intelligence judgments.
        </p>
      </header>

      <div className="methodology-grid">
        <Card>
          <p className="page-card-label">Measure</p>
          <h2>Task behavior</h2>
          <p>
            Browser-recorded sessions may observe accuracy and reaction time for
            a particular protocol, device, and stimulus set.
          </p>
        </Card>
        <Card>
          <p className="page-card-label">Timing</p>
          <h2>Browser limitations</h2>
          <p>
            Browser timestamps do not measure physical photon onset or guarantee
            laboratory-grade timing across devices.
          </p>
        </Card>
        <Card>
          <p className="page-card-label">Interpretation</p>
          <h2>No general ability score</h2>
          <p>
            Condition differences are task observations, not stable traits,
            diagnosis, IQ, rankings, or a combined cognitive score.
          </p>
        </Card>
      </div>

      <section className="page-note">
        <h2>Transparency and safeguards</h2>
        <p>
          Scientific explanations should distinguish established findings,
          protocol choices, and future validation. Participant-facing content
          should remain explicit about uncertainties and accessibility limits.
        </p>
      </section>
    </div>
  );
}
