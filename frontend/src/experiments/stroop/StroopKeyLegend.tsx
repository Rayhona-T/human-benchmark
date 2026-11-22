import { STROOP_RESPONSE_MAPPING } from "./stroop";
import "./StroopExperiment.css";

export function StroopKeyLegend() {
  return (
    <dl className="stroop-key-legend" aria-label="Stroop response keys">
      {STROOP_RESPONSE_MAPPING.map((mapping) => (
        <div key={mapping.logicalKey} className="stroop-key-legend__item">
          <dt>{mapping.logicalKey.toUpperCase()}</dt>
          <dd>
            <span
              className={`stroop-key-legend__color stroop-key-legend__color--${mapping.label.toLowerCase()}`}
              aria-hidden="true"
            />
            {mapping.label}
          </dd>
        </div>
      ))}
    </dl>
  );
}
