import type {
  EngineTrial,
  ExperimentConfiguration,
  ResponseMapping,
} from "../../engine/contracts";
import type { Schedule } from "../../engine/interfaces";

export const STROOP_PROTOCOL_ID = "HB-STROOP-1.0";
export const STROOP_CONFIG_ID = "HB-STROOP-1.0";
export const STROOP_PRNG_ID = "HB-STROOP-shuffle-v1";

export type StroopCondition = "congruent" | "incongruent" | "neutral";
export type StroopResponse = "d" | "f" | "j" | "k";
export type StroopColor = "red" | "blue" | "green" | "yellow";
export type StroopWord =
  | "RED"
  | "BLUE"
  | "GREEN"
  | "YELLOW"
  | "BOOK"
  | "CHAIR"
  | "HOUSE"
  | "TABLE"
  | "MUSIC";

export type StroopInkHex = "#F87171" | "#60A5FA" | "#4ADE80" | "#FACC15";

export interface StroopStimulus {
  word: StroopWord;
  inkColor: StroopColor;
  inkHex: StroopInkHex;
  fontSizePx: 48;
  fontWeight: 700;
  fontFamily: "Arial, Helvetica, sans-serif";
  background: "#111827";
}

export type StroopTrial = EngineTrial<
  StroopStimulus,
  StroopCondition,
  StroopResponse
>;

export interface StroopScheduleMetadata {
  seedUnsigned32: number;
  prngAndScheduleId: string;
  randomizationConfigurationVersion: string;
  scheduleGenerationStatus: "generated";
  selectedDerangement: readonly number[];
  realizedPracticeOrder: readonly StroopTrial[];
  realizedMainOrder: readonly StroopTrial[];
  practiceSeedUnsigned32: number;
}

export type StroopSchedule = Schedule<StroopTrial> & {
  metadata: StroopScheduleMetadata;
};

export const STROOP_COLORS: readonly StroopColor[] = [
  "red",
  "blue",
  "green",
  "yellow",
];
export const STROOP_COLOR_WORDS: readonly StroopWord[] = [
  "RED",
  "BLUE",
  "GREEN",
  "YELLOW",
];
export const STROOP_NEUTRAL_WORDS: readonly StroopWord[] = [
  "BOOK",
  "CHAIR",
  "HOUSE",
  "TABLE",
  "MUSIC",
];

export const STROOP_INK_HEX: Readonly<Record<StroopColor, StroopInkHex>> = {
  red: "#F87171",
  blue: "#60A5FA",
  green: "#4ADE80",
  yellow: "#FACC15",
};

export const STROOP_RESPONSE_MAPPING: readonly ResponseMapping<StroopResponse>[] =
  [
    { responseValue: "d", logicalKey: "d", label: "Red" },
    { responseValue: "f", logicalKey: "f", label: "Blue" },
    { responseValue: "j", logicalKey: "j", label: "Green" },
    { responseValue: "k", logicalKey: "k", label: "Yellow" },
  ];

export const STROOP_CONFIGURATION: ExperimentConfiguration<
  StroopStimulus,
  StroopCondition,
  StroopResponse
> = {
  experimentId: "stroop",
  protocolId: STROOP_PROTOCOL_ID,
  protocolVersion: "1.0",
  configurationId: STROOP_CONFIG_ID,
  configurationVersion: "1.0",
  practice: {
    trialCount: 12,
    responseDeadlineMs: 2000,
    fixationMs: 500,
    interTrialIntervalMs: 500,
    feedbackEnabled: true,
  },
  main: {
    trialCount: 60,
    responseDeadlineMs: 2000,
    fixationMs: 500,
    interTrialIntervalMs: 500,
    feedbackEnabled: false,
    breakAfterTrialIndex: 30,
  },
  stimulusDefinition: {
    word: "RED",
    inkColor: "red",
    inkHex: "#F87171",
    fontSizePx: 48,
    fontWeight: 700,
    fontFamily: "Arial, Helvetica, sans-serif",
    background: "#111827",
  },
  conditions: ["congruent", "incongruent", "neutral"],
  responseMapping: STROOP_RESPONSE_MAPPING,
  minimumCorrectResponsesForMedian: 10,
  neutralCondition: "neutral",
};
