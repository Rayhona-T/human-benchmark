import { useEffect, useId, useRef, useState } from "react";
import {
  GAP_HIGHLIGHT_DAYS,
  metricValue,
  type IncludedSession,
  type TrendMetric,
} from "../../experiments/shared/observatory/trends";

/**
 * One metric across comparable sessions, by SESSION ORDER (not calendar
 * time). Deliberately plain:
 *   - one mark per session and condition, each its own shape and colour;
 *   - no connecting lines, trend line, smoothing or forecast;
 *   - the value axis always starts at 0 and spans the full scale (0–2,000 ms
 *     or 0–100 %), so small differences are not magnified;
 *   - long intervals between sessions are marked, so the even spacing of the
 *     sequence is not mistaken for regular measurement;
 *   - missing values are left out (never drawn as 0) and listed in the
 *     description and the table.
 * Session details are reachable without a pointer: the page's session
 * selector and table carry the same information.
 */

const SHAPES = ["circle", "square", "diamond"] as const;
const MARGIN = { top: 28, right: 16, bottom: 48, left: 56 };
const HEIGHT = 300;

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

function Mark({
  shape,
  x,
  y,
  size,
  className,
}: {
  shape: (typeof SHAPES)[number];
  x: number;
  y: number;
  size: number;
  className: string;
}) {
  if (shape === "circle") {
    return <circle cx={x} cy={y} r={size / 2} className={className} />;
  }
  if (shape === "square") {
    return (
      <rect
        x={x - size / 2}
        y={y - size / 2}
        width={size}
        height={size}
        className={className}
      />
    );
  }
  const h = (size / 2) * 1.25;
  return (
    <polygon
      points={`${x},${y - h} ${x + h},${y} ${x},${y + h} ${x - h},${y}`}
      className={className}
    />
  );
}

export function TrendLegend({
  conditions,
  conditionLabel,
}: {
  conditions: readonly string[];
  conditionLabel: Readonly<Record<string, string>>;
}) {
  return (
    <ul className="trend-chart__legend" aria-label="Conditions">
      {conditions.map((condition, index) => (
        <li key={condition}>
          <svg width="16" height="16" aria-hidden="true">
            <Mark
              shape={SHAPES[index % SHAPES.length]}
              x={8}
              y={8}
              size={10}
              className={`trend-chart__mark trend-chart__mark--c${index}`}
            />
          </svg>
          {conditionLabel[condition] ?? condition}
        </li>
      ))}
    </ul>
  );
}

export function TrendChart({
  title,
  sessions,
  conditions,
  conditionLabel,
  metric,
  domainMax,
  tickStep,
  formatTick,
  formatValue,
  formatDate,
  selectedNumber,
  onSelect,
}: {
  title: string;
  sessions: readonly IncludedSession[];
  conditions: readonly string[];
  conditionLabel: Readonly<Record<string, string>>;
  metric: TrendMetric;
  domainMax: number;
  tickStep: number;
  formatTick: (value: number) => string;
  formatValue: (value: number) => string;
  formatDate: (iso: string) => string;
  selectedNumber: number;
  onSelect: (sessionNumber: number) => void;
}) {
  const ids = useId();
  const { ref, width: measured } = useElementWidth(720);
  const width = Math.max(300, measured);
  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const count = sessions.length;
  const slot = plotWidth / Math.max(count, 1);
  const markSize = Math.max(6, Math.min(10, slot / 4));
  const spread = Math.min(slot * 0.22, 14);
  const offsets = conditions.map(
    (_, index) => (index - (conditions.length - 1) / 2) * spread,
  );
  const xOf = (position: number) => MARGIN.left + slot * (position + 0.5);
  const yOf = (value: number) =>
    MARGIN.top +
    plotHeight -
    (Math.min(value, domainMax) / domainMax) * plotHeight;
  const ticks: number[] = [];
  for (let tick = 0; tick <= domainMax + 1e-9; tick += tickStep)
    ticks.push(tick);
  // Show every k-th session label when slots are too narrow for all of them.
  const labelEvery = Math.max(1, Math.ceil(44 / slot));

  const description = conditions
    .map((condition) => {
      const label = conditionLabel[condition] ?? condition;
      const values = sessions
        .map((session) => {
          const value = metricValue(session, condition, metric);
          return `session ${session.number} ${value === null ? "not available" : formatValue(value)}`;
        })
        .join(", ");
      return `${label}: ${values}`;
    })
    .join(". ");

  return (
    <div className="trend-chart" ref={ref}>
      <svg
        className="trend-chart__svg"
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="img"
        aria-labelledby={`${ids}-title ${ids}-desc`}
      >
        <title id={`${ids}-title`}>{title}</title>
        <desc id={`${ids}-desc`}>
          By session order, from session 1 (earliest). {description}.
        </desc>

        {sessions.map((session, position) =>
          session.number === selectedNumber ? (
            <rect
              key={`selected-${session.number}`}
              className="trend-chart__selected"
              x={MARGIN.left + slot * position}
              y={MARGIN.top}
              width={slot}
              height={plotHeight}
            />
          ) : null,
        )}

        {ticks.map((tick) => (
          <g key={tick}>
            <line
              className="trend-chart__grid"
              x1={MARGIN.left}
              x2={MARGIN.left + plotWidth}
              y1={yOf(tick)}
              y2={yOf(tick)}
            />
            <text
              className="trend-chart__tick"
              x={MARGIN.left - 8}
              y={yOf(tick)}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {formatTick(tick)}
            </text>
          </g>
        ))}

        {sessions.map((session, position) =>
          position > 0 &&
          session.daysSincePrevious !== null &&
          session.daysSincePrevious >= GAP_HIGHLIGHT_DAYS ? (
            <g key={`gap-${session.number}`} data-gap-before={session.number}>
              <line
                className="trend-chart__gap"
                x1={MARGIN.left + slot * position}
                x2={MARGIN.left + slot * position}
                y1={MARGIN.top - 6}
                y2={MARGIN.top + plotHeight}
              />
              <text
                className="trend-chart__gap-label"
                x={MARGIN.left + slot * position}
                y={MARGIN.top - 10}
                textAnchor="middle"
              >
                {Math.floor(session.daysSincePrevious)} days
              </text>
            </g>
          ) : null,
        )}

        {sessions.map((session, position) =>
          conditions.map((condition, index) => {
            const value = metricValue(session, condition, metric);
            if (value === null) return null;
            return (
              <Mark
                key={`${session.number}-${condition}`}
                shape={SHAPES[index % SHAPES.length]}
                x={xOf(position) + offsets[index]}
                y={yOf(value)}
                size={markSize}
                className={`trend-chart__mark trend-chart__mark--c${index}`}
              />
            );
          }),
        )}

        <line
          className="trend-chart__axis"
          x1={MARGIN.left}
          x2={MARGIN.left + plotWidth}
          y1={MARGIN.top + plotHeight}
          y2={MARGIN.top + plotHeight}
        />
        {sessions.map((session, position) =>
          position % labelEvery === 0 || session.number === selectedNumber ? (
            <text
              key={`label-${session.number}`}
              className={`trend-chart__session${session.number === selectedNumber ? " trend-chart__session--selected" : ""}`}
              x={xOf(position)}
              y={MARGIN.top + plotHeight + 16}
              textAnchor="middle"
            >
              <tspan x={xOf(position)}>#{session.number}</tspan>
              <tspan x={xOf(position)} dy="14">
                {formatDate(session.createdAt)}
              </tspan>
            </text>
          ) : null,
        )}

        {/* Pointer shortcut only; the session selector does the same. */}
        {sessions.map((session, position) => (
          <rect
            key={`hit-${session.number}`}
            className="trend-chart__hit"
            x={MARGIN.left + slot * position}
            y={MARGIN.top}
            width={slot}
            height={plotHeight + MARGIN.bottom}
            onClick={() => onSelect(session.number)}
            aria-hidden="true"
          />
        ))}
      </svg>
    </div>
  );
}
