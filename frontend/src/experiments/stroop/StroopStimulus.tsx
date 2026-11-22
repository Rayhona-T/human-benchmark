import type { StroopStimulus as StroopStimulusData } from "./stroop";
import "./StroopExperiment.css";

interface StroopStimulusProps {
  stimulus: StroopStimulusData;
}

export function StroopStimulus({ stimulus }: StroopStimulusProps) {
  return (
    <div
      className="stroop-stimulus"
      style={{
        color: stimulus.inkHex,
        fontSize: `${stimulus.fontSizePx}px`,
        fontWeight: stimulus.fontWeight,
        fontFamily: stimulus.fontFamily,
      }}
    >
      {stimulus.word}
    </div>
  );
}
