import { useEffect, useId, useRef, useState } from "react";
import {
  dodgeLanes,
  wrapTokens,
  type RtPlotData,
  type RtPlotRow,
} from "./rtPlotData";
import { formatMs } from "./resultsFormat";
import "./RtDotPlot.css";

const DOT_RADIUS = 5; // 10 px markers (>= 8 px)
const LANE_STEP = DOT_RADIUS * 2 + 2; // 2 px surface gap between lanes
const MIN_GAP = DOT_RADIUS * 2 + 1;
const SIDE_PADDING = 14;
const LINE_HEIGHT = 16;
const HEADER_GAP = 10;
/** Conservative average glyph widths (px) for 13 px and 12 px sans text. */
const LABEL_CHAR_PX = 7.4;
const META_CHAR_PX = 6.8;
const ROW_PADDING = 12;
const AXIS_BAND = 40;
const TICK_STEP_MS = 500;

/** Tracks an element's width; falls back when ResizeObserver is absent. */
function useElementWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0);
      if (next > 0) setWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

function rowSummary<TCondition extends string>(
  row: RtPlotRow<TCondition>,
  label: string,
  minimum: number,
): string {
  const parts = [
    `${label}: ${row.correctMs.length} correct response time${row.correctMs.length === 1 ? "" : "s"}`,
  ];
  if (row.correctMs.length > 0) {
    parts.push(
      `from ${formatMs(Math.min(...row.correctMs))} to ${formatMs(Math.max(...row.correctMs))}`,
    );
  }
  parts.push(
    row.median.available
      ? `median ${formatMs(row.median.valueMs)}`
      : `median not shown (needs at least ${minimum} correct responses)`,
  );
  if (row.incorrectMs.length > 0) {
    parts.push(`${row.incorrectMs.length} incorrect shown separately`);
  }
  if (row.timeouts > 0) parts.push(`${row.timeouts} timeout(s) with no time`);
  if (row.invalid > 0) parts.push(`${row.invalid} invalid trial(s) not shown`);
  return parts.join(", ");
}

export interface RtDotPlotProps<TCondition extends string> {
  data: RtPlotData<TCondition>;
  conditionLabel: Record<TCondition, string>;
  minimumCorrect: number;
  /** What appeared on screen, e.g. "the word" or "the arrows". */
  stimulusNoun: string;
}

/**
 * Per-condition strip plot of individual correct response times (filled
 * dots) and incorrect responses (rings), with the approved median marked.
 * One shared millisecond axis from 0 to the response window; no trimming.
 */
export function RtDotPlot<TCondition extends string>({
  data,
  conditionLabel,
  minimumCorrect,
  stimulusNoun,
}: RtDotPlotProps<TCondition>) {
  const { ref, width } = useElementWidth(640);
  const titleId = useId();
  const descId = useId();
  const domainMax = Math.ceil(data.domainMaxMs / TICK_STEP_MS) * TICK_STEP_MS;
  const plotWidth = Math.max(120, width - SIDE_PADDING * 2);
  const x = (ms: number) => SIDE_PADDING + (ms / domainMax) * plotWidth;

  const layouts: {
    row: RtPlotRow<TCondition>;
    points: { ms: number; kind: "correct" | "incorrect" }[];
    lanes: number[];
    top: number;
    header: { kind: "label" | "median" | "meta"; text: string }[];
    headerHeight: number;
    stripHeight: number;
  }[] = [];
  const textWidth = width - SIDE_PADDING * 2;
  let y = 0;
  for (const row of data.rows) {
    // SVG text cannot wrap, so header lines are wrapped to the width here.
    const label = conditionLabel[row.condition];
    const medianText = row.median.available
      ? `median ${formatMs(row.median.valueMs)}`
      : `median not shown (needs ${minimumCorrect} correct)`;
    const counts = [
      `${row.correctMs.length} correct`,
      row.incorrectMs.length > 0 ? `${row.incorrectMs.length} incorrect` : null,
      row.timeouts > 0
        ? `${row.timeouts} timeout${row.timeouts === 1 ? "" : "s"} (no time)`
        : null,
      row.invalid > 0 ? `${row.invalid} invalid (not shown)` : null,
    ].filter((item): item is string => item !== null);
    const oneLine = `${label}  ${medianText}`;
    const header: { kind: "label" | "median" | "meta"; text: string }[] =
      oneLine.length * LABEL_CHAR_PX <= textWidth
        ? [{ kind: "label", text: label }]
        : [
            { kind: "label", text: label },
            { kind: "median", text: medianText },
          ];
    for (const line of wrapTokens(
      counts,
      " · ",
      Math.max(10, Math.floor(textWidth / META_CHAR_PX)),
    )) {
      header.push({ kind: "meta", text: line });
    }
    const headerHeight = header.length * LINE_HEIGHT + HEADER_GAP;
    const points = [
      ...row.correctMs.map((ms) => ({ ms, kind: "correct" as const })),
      ...row.incorrectMs.map((ms) => ({ ms, kind: "incorrect" as const })),
    ];
    const lanes = dodgeLanes(
      points.map((point) => x(point.ms)),
      MIN_GAP,
    );
    const maxLane = lanes.reduce(
      (max, lane) => Math.max(max, Math.abs(lane)),
      0,
    );
    const stripHeight = Math.max(
      24,
      (maxLane * 2 + 1) * LANE_STEP + ROW_PADDING,
    );
    layouts.push({
      row,
      points,
      lanes,
      top: y,
      header,
      headerHeight,
      stripHeight,
    });
    y += headerHeight + stripHeight;
  }
  const height = y + AXIS_BAND;
  const ticks: number[] = [];
  for (let tick = 0; tick <= domainMax; tick += TICK_STEP_MS) ticks.push(tick);

  const description = data.rows
    .map((row) =>
      rowSummary(row, conditionLabel[row.condition], minimumCorrect),
    )
    .join(". ");

  return (
    <div className="rt-plot" ref={ref}>
      <ul className="rt-plot__legend" aria-label="Plot legend">
        <li>
          <svg width="14" height="14" aria-hidden="true">
            <circle cx="7" cy="7" r="5" className="rt-plot__dot--correct" />
          </svg>
          Correct response
        </li>
        <li>
          <svg width="14" height="14" aria-hidden="true">
            <circle cx="7" cy="7" r="4" className="rt-plot__dot--incorrect" />
          </svg>
          Incorrect response (not in the median)
        </li>
        <li>
          <svg width="14" height="14" aria-hidden="true">
            <line x1="7" x2="7" y1="1" y2="13" className="rt-plot__median" />
          </svg>
          Median of correct responses
        </li>
      </ul>
      <svg
        className="rt-plot__svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
      >
        <title id={titleId}>Response times by condition, in milliseconds</title>
        <desc id={descId}>{description}.</desc>
        {ticks.map((tick) => (
          <line
            key={tick}
            className="rt-plot__grid"
            x1={x(tick)}
            x2={x(tick)}
            y1={0}
            y2={height - AXIS_BAND}
          />
        ))}
        {layouts.map(
          ({ row, points, lanes, top, header, headerHeight, stripHeight }) => {
            const center = top + headerHeight + stripHeight / 2;
            const label = conditionLabel[row.condition];
            const medianText = row.median.available
              ? `median ${formatMs(row.median.valueMs)}`
              : `median not shown (needs ${minimumCorrect} correct)`;
            const medianOnLabelLine = !header.some(
              (line) => line.kind === "median",
            );
            return (
              <g key={row.condition} data-condition={row.condition}>
                {header.map((line, lineIndex) => {
                  const lineY = top + 14 + lineIndex * LINE_HEIGHT;
                  if (line.kind === "meta") {
                    return (
                      <text
                        key={lineIndex}
                        className="rt-plot__row-meta"
                        x={SIDE_PADDING}
                        y={lineY}
                      >
                        {line.text}
                      </text>
                    );
                  }
                  return (
                    <text
                      key={lineIndex}
                      className="rt-plot__row-label"
                      x={SIDE_PADDING}
                      y={lineY}
                    >
                      {line.kind === "label" ? (
                        <>
                          <tspan className="rt-plot__row-name">
                            {line.text}
                          </tspan>
                          {medianOnLabelLine ? (
                            <tspan className="rt-plot__row-median">{`  ${medianText}`}</tspan>
                          ) : null}
                        </>
                      ) : (
                        <tspan className="rt-plot__row-median">
                          {line.text}
                        </tspan>
                      )}
                    </text>
                  );
                })}
                {row.median.available ? (
                  <line
                    className="rt-plot__median"
                    x1={x(row.median.valueMs)}
                    x2={x(row.median.valueMs)}
                    y1={top + headerHeight - 2}
                    y2={top + headerHeight + stripHeight}
                  />
                ) : null}
                {points.map((point, index) => (
                  <circle
                    key={`${point.kind}-${index}`}
                    cx={x(point.ms)}
                    cy={center + lanes[index] * LANE_STEP}
                    r={point.kind === "correct" ? DOT_RADIUS : DOT_RADIUS - 1}
                    className={`rt-plot__dot--${point.kind}`}
                  >
                    <title>{`${label}, ${point.kind}: ${formatMs(point.ms)}`}</title>
                  </circle>
                ))}
              </g>
            );
          },
        )}
        <line
          className="rt-plot__axis"
          x1={SIDE_PADDING}
          x2={SIDE_PADDING + plotWidth}
          y1={height - AXIS_BAND}
          y2={height - AXIS_BAND}
        />
        {ticks.map((tick) => (
          <text
            key={tick}
            className="rt-plot__tick"
            x={x(tick)}
            y={height - AXIS_BAND + 16}
            textAnchor={
              tick === 0 ? "start" : tick === domainMax ? "end" : "middle"
            }
          >
            {tick.toLocaleString("en-US")}
          </text>
        ))}
        <text
          className="rt-plot__axis-title"
          x={SIDE_PADDING + plotWidth / 2}
          y={height - 6}
          textAnchor="middle"
        >
          {`Response time (ms) after ${stimulusNoun} appeared`}
        </text>
      </svg>
    </div>
  );
}
