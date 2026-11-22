import type { CSSProperties } from "react";
import { FLANKER_PRESENTATION, type FlankerSymbol } from "./flanker";

const P = FLANKER_PRESENTATION;

/** Protocol §4 geometry, applied exactly; never scaled. */
const ARRAY_STYLE: CSSProperties = {
  display: "flex",
  gap: `${P.cellGapPx}px`,
  width: `${P.arrayWidthPx}px`,
  flex: "0 0 auto",
};

const CELL_STYLE: CSSProperties = {
  width: `${P.cellSizePx}px`,
  height: `${P.cellSizePx}px`,
  flex: "0 0 auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: P.fontFamily,
  fontWeight: P.fontWeight,
  fontSize: `${P.fontSizePx}px`,
  lineHeight: `${P.lineHeightPx}px`,
  color: P.symbolColor,
};

/**
 * Renders five fixed cells (target in the center). Used for the timed
 * stimulus and, with one cell, for the untimed mapping-check arrow.
 */
export function FlankerArray({
  cells,
  className = "flanker-array",
}: {
  cells: readonly FlankerSymbol[];
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        ...ARRAY_STYLE,
        width:
          cells.length === P.cellCount
            ? ARRAY_STYLE.width
            : `${cells.length * P.cellSizePx + (cells.length - 1) * P.cellGapPx}px`,
      }}
    >
      {cells.map((symbol, index) => (
        <span key={index} className="flanker-cell" style={CELL_STYLE}>
          {symbol}
        </span>
      ))}
    </div>
  );
}
