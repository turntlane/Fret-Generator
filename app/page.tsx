"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type Unit = "mm" | "in";
type MarkerShape = "dot" | "rectangle" | "diamond" | "trapezoid";
type MarkerCount = 1 | 2;
type GCodeFileExtension = ".nc" | ".gcode" | ".tap" | ".cnc" | ".ngc";
type GCodeProgram =
  | "fret-slots"
  | "fretboard-markers"
  | "fretboard-cutout"
  | "fretboard-radius";

type FormState = {
  unit: Unit;
  scaleLength: number;
  fretCount: number;
  nutStringSpread: number;
  bridgeStringSpread: number;
  fretboardOverhang: number;
  fretInset: number;
  nutEndMargin: number;
  lastFretEndMargin: number;
  materialWidth: number;
  materialLength: number;
  materialThickness: number;
  bitDiameter: number;
  fretboardRadius: number;
  slotDepth: number;
  feedRate: number;
  depthPerPass: number;
  spindleRpm: number;
  radiusBitDiameter: number;
  radiusStepOver: number;
  radiusDepthPerPass: number;
  radiusFeedRate: number;
  radiusPlungeRate: number;
  radiusSpindleRpm: number;
  cutoutBitDiameter: number;
  cutoutDepth: number;
  cutoutDepthPerPass: number;
  cutoutFeedRate: number;
  cutoutPlungeRate: number;
  cutoutSpindleRpm: number;
  cutoutAllowance: number;
  cutoutTabsEnabled: boolean;
  tabCount: number;
  tabWidth: number;
  tabHeight: number;
  markersEnabled: boolean;
  markerShape: MarkerShape;
  markerFrets: string;
  markerWidth: number;
  markerLength: number;
  markerTopWidth: number;
  markerDepth: number;
  markerDepthPerPass: number;
  markerBitDiameter: number;
  markerFeedRate: number;
  markerPlungeRate: number;
  markerSpindleRpm: number;
  markerXOffset: number;
  doubleMarkerSpacing: number;
};

type FretSlot = {
  fret: number;
  scalePosition: number;
  y: number;
  stringSpread: number;
  fretboardWidth: number;
  slotLength: number;
  startX: number;
  endX: number;
};

type Layout = {
  centerX: number;
  nutY: number;
  lastFretY: number;
  maxFretboardWidth: number;
  slots: FretSlot[];
};

type Point = {
  x: number;
  y: number;
};

type FretboardOutline = {
  startY: number;
  endY: number;
  nutWidth: number;
  endWidth: number;
  points: Point[];
  cutterPath: Point[];
};

type MarkerPocket = {
  id: string;
  fretSpace: number;
  markerIndex: number;
  markerCount: MarkerCount;
  centerX: number;
  y: number;
  shape: MarkerShape;
};

type MarkerAssignment = {
  fretSpace: number;
  count: MarkerCount;
};

type ParsedMarkerAssignments = {
  assignments: MarkerAssignment[];
  invalidTokens: string[];
  duplicateFrets: number[];
};

const defaultMetricState: FormState = {
  unit: "mm",
  scaleLength: 647.7,
  fretCount: 22,
  nutStringSpread: 35,
  bridgeStringSpread: 52,
  fretboardOverhang: 3,
  fretInset: 1.5,
  nutEndMargin: 6,
  lastFretEndMargin: 12,
  materialWidth: 70,
  materialLength: 500,
  materialThickness: 8,
  bitDiameter: 0.6,
  fretboardRadius: 305,
  slotDepth: 1.5,
  feedRate: 300,
  depthPerPass: 0.3,
  spindleRpm: 18000,
  radiusBitDiameter: 6.35,
  radiusStepOver: 1.5,
  radiusDepthPerPass: 0.4,
  radiusFeedRate: 500,
  radiusPlungeRate: 120,
  radiusSpindleRpm: 18000,
  cutoutBitDiameter: 3.175,
  cutoutDepth: 8,
  cutoutDepthPerPass: 1,
  cutoutFeedRate: 240,
  cutoutPlungeRate: 80,
  cutoutSpindleRpm: 18000,
  cutoutAllowance: 0,
  cutoutTabsEnabled: true,
  tabCount: 4,
  tabWidth: 8,
  tabHeight: 1.5,
  markersEnabled: true,
  markerShape: "dot",
  markerFrets: "3,5,7,9,12:2,15,17:2,19,21",
  markerWidth: 6,
  markerLength: 6,
  markerTopWidth: 4,
  markerDepth: 1.5,
  markerDepthPerPass: 0.4,
  markerBitDiameter: 1.5,
  markerFeedRate: 240,
  markerPlungeRate: 80,
  markerSpindleRpm: 18000,
  markerXOffset: 0,
  doubleMarkerSpacing: 18,
};

const gCodeFileExtensions: GCodeFileExtension[] = [
  ".nc",
  ".gcode",
  ".tap",
  ".cnc",
  ".ngc",
];

const markerShapes: MarkerShape[] = ["dot", "rectangle", "diamond", "trapezoid"];

type SavedProfile = {
  name: string;
  form: FormState;
  fileExtension: GCodeFileExtension;
};

const lastSessionStorageKey = "fretboard-gcode:last-session";
const profilesStorageKey = "fretboard-gcode:profiles";

function sanitizeFormState(value: unknown): FormState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const next = { ...defaultMetricState };

  for (const key of Object.keys(defaultMetricState) as Array<keyof FormState>) {
    const stored = record[key];
    if (typeof stored === typeof defaultMetricState[key]) {
      next[key] = stored as never;
    }
  }

  if (next.unit !== "mm" && next.unit !== "in") {
    next.unit = defaultMetricState.unit;
  }

  if (!markerShapes.includes(next.markerShape)) {
    next.markerShape = defaultMetricState.markerShape;
  }

  return next;
}

function sanitizeFileExtension(value: unknown): GCodeFileExtension | null {
  return gCodeFileExtensions.includes(value as GCodeFileExtension)
    ? (value as GCodeFileExtension)
    : null;
}

function sanitizeProfiles(value: unknown): SavedProfile[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): SavedProfile[] => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const record = entry as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const form = sanitizeFormState(record.form);

    if (!name || !form) {
      return [];
    }

    return [
      {
        name,
        form,
        fileExtension: sanitizeFileExtension(record.fileExtension) ?? ".nc",
      },
    ];
  });
}

const linearInputKeys: Array<keyof FormState> = [
  "scaleLength",
  "nutStringSpread",
  "bridgeStringSpread",
  "fretboardOverhang",
  "fretInset",
  "nutEndMargin",
  "lastFretEndMargin",
  "materialWidth",
  "materialLength",
  "materialThickness",
  "bitDiameter",
  "fretboardRadius",
  "slotDepth",
  "depthPerPass",
  "radiusBitDiameter",
  "radiusStepOver",
  "radiusDepthPerPass",
  "radiusFeedRate",
  "radiusPlungeRate",
  "cutoutBitDiameter",
  "cutoutDepth",
  "cutoutDepthPerPass",
  "cutoutFeedRate",
  "cutoutPlungeRate",
  "cutoutAllowance",
  "tabWidth",
  "tabHeight",
  "markerWidth",
  "markerLength",
  "markerTopWidth",
  "markerDepth",
  "markerDepthPerPass",
  "markerBitDiameter",
  "markerFeedRate",
  "markerPlungeRate",
  "markerXOffset",
  "doubleMarkerSpacing",
];

const fieldDescriptions: Record<string, string> = {
  scaleLength:
    "The vibrating string length from the nut to the bridge saddles. Every fret position is derived from this length using the equal-temperament formula.",
  fretCount: "Total number of fret slots to calculate and cut.",
  nutStringSpread:
    "Center-to-center distance between the two outer strings at the nut. Together with the overhang, this sets the board width at the nut.",
  bridgeStringSpread:
    "Center-to-center distance between the two outer strings at the bridge. Controls how much the board tapers wider toward the body.",
  fretboardOverhang:
    "Extra board width outside each outer string so the strings do not sit right on the board edge.",
  fretboardRadius:
    "Radius of the curved top surface across the board, e.g. 305 mm (12 in). Larger values give a flatter board.",
  nutEndMargin:
    "Extra board length added beyond the nut line at the headstock end of the board outline.",
  lastFretEndMargin:
    "Extra board length added past the last fret at the body end of the board outline.",
  materialWidth:
    "Width of the stock blank (X axis). The board is centered across this width.",
  materialLength:
    "Length of the stock blank (Y axis). The fret layout is centered along this length.",
  materialThickness:
    "Thickness of the stock blank (Z axis). Used to validate cut depths.",
  fretInset:
    "How far each slot end stops short of the board edge on each side, so the slots stay hidden at the edges.",
  bitDiameter:
    "Diameter of the slotting cutter. This equals the finished slot width, so match it to your fret tang.",
  slotDepth:
    "Final slot depth measured from the radiused top surface at every point along the slot.",
  feedRate:
    "Cutting speed while milling along each slot, in the selected unit per minute.",
  depthPerPass:
    "Maximum depth removed per pass. Each slot is recut in steps until it reaches the full slot depth.",
  spindleRpm: "Spindle speed while cutting fret slots.",
  cutoutBitDiameter:
    "Diameter of the end mill used to profile the board outline. The toolpath is offset outward by half this diameter.",
  cutoutDepth:
    "Total depth of the outline cut. Set it to the material thickness to cut all the way through.",
  cutoutDepthPerPass: "Depth removed on each loop around the outline.",
  cutoutFeedRate: "Cutting speed while profiling the outline.",
  cutoutPlungeRate:
    "Feed used for downward Z moves at the start of each outline pass.",
  cutoutSpindleRpm: "Spindle speed for the outline cut.",
  cutoutAllowance:
    "Extra material left outside the final outline for cleanup or sanding. Zero cuts exactly to final size.",
  cutoutTabsEnabled:
    "Leaves small uncut bridges along the outline so the board stays attached to the blank until you free it by hand.",
  tabCount: "Number of holding tabs spaced evenly around the outline.",
  tabWidth: "Length of each holding tab along the cut path.",
  tabHeight:
    "Thickness of material left uncut under the cutter at each tab. Must be smaller than the cutout depth.",
  radiusBitDiameter:
    "Diameter of the surfacing cutter used to mill the curved top.",
  radiusStepOver:
    "Distance between surfacing rows along the board length. Smaller values give a smoother top but a longer program.",
  radiusDepthPerPass:
    "Maximum material removed at the board edges in one surfacing pass. The curve is recut deeper until it reaches the full radius.",
  radiusFeedRate: "Cutting speed while surfacing the radius.",
  radiusPlungeRate:
    "Feed used for downward Z moves at the start of each surfacing row.",
  radiusSpindleRpm: "Spindle speed for the radius surfacing.",
  markersEnabled:
    "Adds inlay marker pockets to the markers-only export and to the combined fret slots program.",
  markerShape:
    "Pocket shape cut for each marker: round dot, rectangle, diamond, or trapezoid inlay.",
  markerFrets:
    "Comma-separated fret spaces that get markers. Add :2 for a double marker, e.g. 3,5,7,9,12:2.",
  fretSpaceMarkers:
    "Quick toggles for the marker map above: choose no marker, a single centered marker, or a double marker for each fret space.",
  markerWidth:
    "Dot diameter, or the overall side-to-side width of rectangle, diamond, and trapezoid pockets.",
  markerLength:
    "Pocket size along the board length for rectangle, diamond, and trapezoid shapes.",
  markerTopWidth:
    "Width of the trapezoid's nut-side edge. Cannot be wider than the marker width.",
  markerDepth:
    "Final pocket depth below the radiused top surface. Match your inlay thickness.",
  markerDepthPerPass: "Depth removed per pocket clearing pass.",
  markerBitDiameter:
    "Diameter of the cutter used to clear the marker pockets. Must be smaller than the marker width.",
  markerFeedRate: "Cutting speed while clearing marker pockets.",
  markerPlungeRate: "Feed used for downward Z moves into each pocket.",
  markerSpindleRpm: "Spindle speed for marker pockets.",
  markerXOffset:
    "Shifts all markers sideways from the board centerline. Zero keeps them centered.",
  doubleMarkerSpacing:
    "Center-to-center distance between the two pockets of a double marker.",
  fileExtension:
    "File extension used for the downloaded program. The G-code content is the same; pick the extension your machine controller expects.",
};

type HighlightTarget =
  | "material"
  | "outline"
  | "cutterPath"
  | "slots"
  | "markers"
  | "radius";

const highlightColor = "#e07b00";

const fieldHighlightTargets: Record<string, HighlightTarget> = {
  scaleLength: "slots",
  fretCount: "slots",
  nutStringSpread: "outline",
  bridgeStringSpread: "outline",
  fretboardOverhang: "outline",
  fretboardRadius: "radius",
  nutEndMargin: "outline",
  lastFretEndMargin: "outline",
  materialWidth: "material",
  materialLength: "material",
  materialThickness: "material",
  fretInset: "slots",
  bitDiameter: "slots",
  slotDepth: "slots",
  feedRate: "slots",
  depthPerPass: "slots",
  spindleRpm: "slots",
  cutoutBitDiameter: "cutterPath",
  cutoutDepth: "cutterPath",
  cutoutDepthPerPass: "cutterPath",
  cutoutFeedRate: "cutterPath",
  cutoutPlungeRate: "cutterPath",
  cutoutSpindleRpm: "cutterPath",
  cutoutAllowance: "cutterPath",
  cutoutTabsEnabled: "cutterPath",
  tabCount: "cutterPath",
  tabWidth: "cutterPath",
  tabHeight: "cutterPath",
  radiusBitDiameter: "radius",
  radiusStepOver: "radius",
  radiusDepthPerPass: "radius",
  radiusFeedRate: "radius",
  radiusPlungeRate: "radius",
  radiusSpindleRpm: "radius",
  markersEnabled: "markers",
  markerShape: "markers",
  markerFrets: "markers",
  fretSpaceMarkers: "markers",
  markerWidth: "markers",
  markerLength: "markers",
  markerTopWidth: "markers",
  markerDepth: "markers",
  markerDepthPerPass: "markers",
  markerBitDiameter: "markers",
  markerFeedRate: "markers",
  markerPlungeRate: "markers",
  markerSpindleRpm: "markers",
  markerXOffset: "markers",
  doubleMarkerSpacing: "markers",
};

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 4,
});

function formatNumber(value: number, digits = 4) {
  if (!Number.isFinite(value)) {
    throw new Error(
      "G-code generation produced a coordinate that is not a finite number. Check the fretboard radius, marker layout, and board dimensions.",
    );
  }
  return value.toFixed(digits);
}

function gCodeComment(text: string) {
  return `(${text.replace(/[()]/g, "").replace(/\s+/g, " ").trim()})`;
}

function gCodeFilename(extension: GCodeFileExtension, program: GCodeProgram) {
  return `${program}${extension}`;
}

function gCodeFileTypeLabel(extension: GCodeFileExtension) {
  switch (extension) {
    case ".gcode":
      return "Generic G-code";
    case ".tap":
      return "TAP G-code";
    case ".cnc":
      return "CNC program";
    case ".ngc":
      return "LinuxCNC NGC";
    case ".nc":
    default:
      return "NC G-code";
  }
}

function svgNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(6) : "0";
}

function rounded(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function convertUnits(state: FormState, nextUnit: Unit): FormState {
  if (state.unit === nextUnit) {
    return state;
  }

  const factor = nextUnit === "in" ? 1 / 25.4 : 25.4;
  const nextState = { ...state, unit: nextUnit };

  for (const key of linearInputKeys) {
    const value = nextState[key];
    if (value === "") {
      continue;
    }
    nextState[key] = rounded(Number(value) * factor, 5) as never;
  }

  if (String(nextState.feedRate) !== "") {
    nextState.feedRate = rounded(Number(nextState.feedRate) * factor, 4);
  }
  return nextState;
}

function calculateLayout(input: FormState): Layout {
  const centerX = input.materialWidth / 2;
  const fretPositions = Array.from({ length: input.fretCount }, (_, index) => {
    const fret = index + 1;
    const scalePosition = input.scaleLength * (1 - 2 ** (-fret / 12));
    return { fret, scalePosition };
  });
  const lastScalePosition =
    fretPositions[fretPositions.length - 1]?.scalePosition ?? 0;
  const nutY = (input.materialLength - lastScalePosition) / 2;

  const slots = fretPositions.map(({ fret, scalePosition }) => {
    const taperRatio = scalePosition / input.scaleLength;
    const stringSpread =
      input.nutStringSpread +
      (input.bridgeStringSpread - input.nutStringSpread) * taperRatio;
    const fretboardWidth = stringSpread + input.fretboardOverhang * 2;
    const slotLength = fretboardWidth - input.fretInset * 2;
    const toolRadius = input.bitDiameter / 2;

    return {
      fret,
      scalePosition,
      y: nutY + scalePosition,
      stringSpread,
      fretboardWidth,
      slotLength,
      startX: centerX - slotLength / 2 + toolRadius,
      endX: centerX + slotLength / 2 - toolRadius,
    };
  });

  const maxFretboardWidth = slots.reduce(
    (maxWidth, slot) => Math.max(maxWidth, slot.fretboardWidth),
    input.nutStringSpread + input.fretboardOverhang * 2,
  );

  return {
    centerX,
    nutY,
    lastFretY: nutY + lastScalePosition,
    maxFretboardWidth,
    slots,
  };
}

function fretboardWidthAtScalePosition(input: FormState, scalePosition: number) {
  const taperRatio = clamp(scalePosition / input.scaleLength, 0, 1);
  const stringSpread =
    input.nutStringSpread +
    (input.bridgeStringSpread - input.nutStringSpread) * taperRatio;
  return stringSpread + input.fretboardOverhang * 2;
}

function calculateFretboardOutline(
  input: FormState,
  layout: Layout,
): FretboardOutline {
  const startY = layout.nutY - Number(input.nutEndMargin);
  const endY = layout.lastFretY + Number(input.lastFretEndMargin);
  const nutWidth = Number(input.nutStringSpread) + Number(input.fretboardOverhang) * 2;
  const endWidth = fretboardWidthAtScalePosition(
    input,
    Math.max(endY - layout.nutY, 0),
  );
  const toolOffset =
    Number(input.cutoutBitDiameter) / 2 + Number(input.cutoutAllowance);

  const points = [
    { x: layout.centerX - nutWidth / 2, y: startY },
    { x: layout.centerX + nutWidth / 2, y: startY },
    { x: layout.centerX + endWidth / 2, y: endY },
    { x: layout.centerX - endWidth / 2, y: endY },
  ];

  const cutterPath = [
    { x: layout.centerX - nutWidth / 2 - toolOffset, y: startY - toolOffset },
    { x: layout.centerX + nutWidth / 2 + toolOffset, y: startY - toolOffset },
    { x: layout.centerX + endWidth / 2 + toolOffset, y: endY + toolOffset },
    { x: layout.centerX - endWidth / 2 - toolOffset, y: endY + toolOffset },
  ];

  return {
    startY,
    endY,
    nutWidth,
    endWidth,
    points,
    cutterPath,
  };
}

function fretboardOutlineWidthAtY(outline: FretboardOutline, y: number) {
  const ratio = clamp(
    (y - outline.startY) / Math.max(outline.endY - outline.startY, 0.000001),
    0,
    1,
  );
  return outline.nutWidth + (outline.endWidth - outline.nutWidth) * ratio;
}

function radiusSagitta(input: FormState, layout: Layout, x: number) {
  const xFromCenter = x - layout.centerX;
  return (
    input.fretboardRadius -
    Math.sqrt(input.fretboardRadius ** 2 - xFromCenter ** 2)
  );
}

function parseMarkerAssignments(value: string): ParsedMarkerAssignments {
  const assignments: MarkerAssignment[] = [];
  const invalidTokens: string[] = [];
  const duplicateFrets = new Set<number>();
  const seenFrets = new Set<number>();

  for (const token of value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)) {
    const match = token.match(/^(\d+)(?::([12]))?$/);

    if (!match) {
      invalidTokens.push(token);
      continue;
    }

    const fretSpace = Number(match[1]);
    const count = (match[2] ? Number(match[2]) : 1) as MarkerCount;

    if (seenFrets.has(fretSpace)) {
      duplicateFrets.add(fretSpace);
      continue;
    }

    seenFrets.add(fretSpace);
    assignments.push({ fretSpace, count });
  }

  return {
    assignments: assignments.sort((a, b) => a.fretSpace - b.fretSpace),
    invalidTokens,
    duplicateFrets: Array.from(duplicateFrets).sort((a, b) => a - b),
  };
}

function formatMarkerAssignments(assignments: MarkerAssignment[]) {
  return assignments
    .sort((a, b) => a.fretSpace - b.fretSpace)
    .map((assignment) =>
      assignment.count === 1
        ? String(assignment.fretSpace)
        : `${assignment.fretSpace}:2`,
    )
    .join(",");
}

function markerCenterY(fretSpace: number, layout: Layout) {
  const previousY =
    fretSpace === 1 ? layout.nutY : layout.slots[fretSpace - 2]?.y;
  const nextY = layout.slots[fretSpace - 1]?.y;

  if (!Number.isFinite(previousY) || !Number.isFinite(nextY)) {
    return Number.NaN;
  }

  return ((previousY as number) + (nextY as number)) / 2;
}

function calculateMarkers(input: FormState, layout: Layout): MarkerPocket[] {
  if (!input.markersEnabled) {
    return [];
  }

  return parseMarkerAssignments(input.markerFrets).assignments.flatMap((assignment): MarkerPocket[] => {
    const { fretSpace, count } = assignment;
    const y = markerCenterY(fretSpace, layout);
    if (!Number.isFinite(y)) {
      return [];
    }

    const baseX = layout.centerX + Number(input.markerXOffset);

    if (count === 2) {
      const spacing = Number(input.doubleMarkerSpacing);
      return [
        {
          id: `${fretSpace}-bass`,
          fretSpace,
          markerIndex: 1,
          markerCount: count,
          centerX: baseX - spacing / 2,
          y,
          shape: input.markerShape,
        },
        {
          id: `${fretSpace}-treble`,
          fretSpace,
          markerIndex: 2,
          markerCount: count,
          centerX: baseX + spacing / 2,
          y,
          shape: input.markerShape,
        },
      ];
    }

    return [
      {
        id: `${fretSpace}`,
        fretSpace,
        markerIndex: 1,
        markerCount: count,
        centerX: baseX,
        y,
        shape: input.markerShape,
      },
    ];
  });
}

function polygonCentroid(points: Point[]) {
  return points.reduce(
    (acc, point) => ({
      x: acc.x + point.x / points.length,
      y: acc.y + point.y / points.length,
    }),
    { x: 0, y: 0 },
  );
}

function polygonArea(points: Point[]) {
  return (
    points.reduce((total, point, index) => {
      const next = points[(index + 1) % points.length];
      return total + point.x * next.y - next.x * point.y;
    }, 0) / 2
  );
}

function insetConvexPolygon(points: Point[], inset: number): Point[] {
  const centroid = polygonCentroid(points);
  const edges = points.map((start, index) => {
    const end = points[(index + 1) % points.length];
    const length = Math.max(pointDistance(start, end), 0.000001);
    let normalX = -(end.y - start.y) / length;
    let normalY = (end.x - start.x) / length;

    if ((centroid.x - start.x) * normalX + (centroid.y - start.y) * normalY < 0) {
      normalX = -normalX;
      normalY = -normalY;
    }

    return {
      x: start.x + normalX * inset,
      y: start.y + normalY * inset,
      directionX: end.x - start.x,
      directionY: end.y - start.y,
    };
  });

  const insetPoints = points.map((_, index) => {
    const previous = edges[(index + edges.length - 1) % edges.length];
    const current = edges[index];
    const determinant =
      previous.directionX * current.directionY -
      previous.directionY * current.directionX;

    if (Math.abs(determinant) < 0.000001) {
      return { x: current.x, y: current.y };
    }

    const t =
      ((current.x - previous.x) * current.directionY -
        (current.y - previous.y) * current.directionX) /
      determinant;
    return {
      x: previous.x + previous.directionX * t,
      y: previous.y + previous.directionY * t,
    };
  });

  // An inset larger than the shape flips the polygon inside out; collapse to a
  // single plunge point at the centroid instead of emitting crossed toolpaths.
  const flipped =
    insetPoints.some(
      (point) => !Number.isFinite(point.x) || !Number.isFinite(point.y),
    ) || Math.sign(polygonArea(insetPoints)) !== Math.sign(polygonArea(points));

  return flipped ? points.map(() => ({ ...centroid })) : insetPoints;
}

function markerPolygon(input: FormState, marker: MarkerPocket) {
  return insetConvexPolygon(
    markerPreviewPolygon(input, marker),
    Number(input.markerBitDiameter) / 2,
  );
}

function markerPreviewPolygon(input: FormState, marker: MarkerPocket) {
  const halfWidth = Number(input.markerWidth) / 2;
  const halfLength = Number(input.markerLength) / 2;
  const halfTopWidth = Number(input.markerTopWidth) / 2;

  if (input.markerShape === "diamond") {
    return [
      { x: marker.centerX, y: marker.y - halfLength },
      { x: marker.centerX + halfWidth, y: marker.y },
      { x: marker.centerX, y: marker.y + halfLength },
      { x: marker.centerX - halfWidth, y: marker.y },
    ];
  }

  if (input.markerShape === "trapezoid") {
    return [
      { x: marker.centerX - halfTopWidth, y: marker.y - halfLength },
      { x: marker.centerX + halfTopWidth, y: marker.y - halfLength },
      { x: marker.centerX + halfWidth, y: marker.y + halfLength },
      { x: marker.centerX - halfWidth, y: marker.y + halfLength },
    ];
  }

  return [
    { x: marker.centerX - halfWidth, y: marker.y - halfLength },
    { x: marker.centerX + halfWidth, y: marker.y - halfLength },
    { x: marker.centerX + halfWidth, y: marker.y + halfLength },
    { x: marker.centerX - halfWidth, y: marker.y + halfLength },
  ];
}

function scaledPolygon(points: Array<{ x: number; y: number }>, scale: number) {
  const center = polygonCentroid(points);

  return points.map((point) => ({
    x: center.x + (point.x - center.x) * scale,
    y: center.y + (point.y - center.y) * scale,
  }));
}

function getValidationMessages(
  input: FormState,
  layout: Layout,
  includeMarkers = true,
  includeCutout = true,
  includeRadius = false,
  includeSlots = true,
) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const positiveFields: Array<[keyof FormState, string]> = [
    ["scaleLength", "Scale length"],
    ["nutStringSpread", "Nut string spread"],
    ["bridgeStringSpread", "Bridge string spread"],
    ["fretboardOverhang", "Fretboard overhang"],
    ["materialWidth", "Material width"],
    ["materialLength", "Material length"],
    ["materialThickness", "Material thickness"],
    ["fretboardRadius", "Fretboard radius"],
  ];

  if (includeSlots) {
    positiveFields.push(
      ["fretInset", "Fret inset"],
      ["bitDiameter", "Bit diameter"],
      ["slotDepth", "Slot depth"],
      ["feedRate", "Feed rate"],
      ["depthPerPass", "Depth per pass"],
      ["spindleRpm", "Spindle RPM"],
    );
  }

  if (includeCutout) {
    positiveFields.push(
      ["cutoutBitDiameter", "Cutout bit diameter"],
      ["cutoutDepth", "Cutout depth"],
      ["cutoutDepthPerPass", "Cutout depth per pass"],
      ["cutoutFeedRate", "Cutout feed rate"],
      ["cutoutPlungeRate", "Cutout plunge rate"],
      ["cutoutSpindleRpm", "Cutout spindle RPM"],
    );
  }

  if (includeRadius) {
    positiveFields.push(
      ["radiusBitDiameter", "Radiusing bit diameter"],
      ["radiusStepOver", "Radiusing step-over"],
      ["radiusDepthPerPass", "Radiusing depth per pass"],
      ["radiusFeedRate", "Radiusing feed rate"],
      ["radiusPlungeRate", "Radiusing plunge rate"],
      ["radiusSpindleRpm", "Radiusing spindle RPM"],
    );
  }

  for (const [key, label] of positiveFields) {
    if (!Number.isFinite(Number(input[key])) || Number(input[key]) <= 0) {
      errors.push(`${label} must be greater than zero.`);
    }
  }

  if (!Number.isInteger(input.fretCount) || input.fretCount < 1) {
    errors.push("Number of frets must be a whole number greater than zero.");
  }

  if (input.fretCount > 36) {
    warnings.push("More than 36 frets will generate a large, unusual program.");
  }

  if (layout.nutY < 0) {
    errors.push("The calculated fret layout is longer than the material.");
  }

  if (layout.maxFretboardWidth > input.materialWidth) {
    errors.push("The calculated fretboard is wider than the material.");
  }

  if (includeSlots) {
    if (input.fretInset < 0) {
      errors.push("Fret inset cannot be negative.");
    }

    const shortestSlot = layout.slots.reduce(
      (shortest, slot) => Math.min(shortest, slot.slotLength),
      Number.POSITIVE_INFINITY,
    );
    if (shortestSlot <= input.bitDiameter) {
      errors.push("Fret inset leaves no room for the cutter inside the slot ends.");
    }

    const largestToolOffset = layout.slots.reduce((largest, slot) => {
      return Math.max(
        largest,
        Math.abs(slot.startX - layout.centerX),
        Math.abs(slot.endX - layout.centerX),
      );
    }, 0);

    if (largestToolOffset >= input.fretboardRadius) {
      errors.push("Fretboard radius must be larger than the widest slot half-span.");
    }

    if (input.slotDepth >= input.materialThickness) {
      warnings.push("Slot depth is equal to or deeper than the material thickness.");
    }
  }

  if (includeCutout) {
    if (!Number.isFinite(Number(input.nutEndMargin)) || Number(input.nutEndMargin) < 0) {
      errors.push("Nut end margin cannot be negative.");
    }

    if (
      !Number.isFinite(Number(input.lastFretEndMargin)) ||
      Number(input.lastFretEndMargin) < 0
    ) {
      errors.push("Last fret end margin cannot be negative.");
    }

    if (
      !Number.isFinite(Number(input.cutoutAllowance)) ||
      Number(input.cutoutAllowance) < 0
    ) {
      errors.push("Cutout allowance cannot be negative.");
    }

    if (Number(input.cutoutDepth) > Number(input.materialThickness)) {
      errors.push("Cutout depth cannot be deeper than the material thickness.");
    } else if (Number(input.cutoutDepth) === Number(input.materialThickness)) {
      warnings.push("Cutout depth is full material thickness; use tabs or strong workholding.");
    }

    const outline = calculateFretboardOutline(input, layout);

    if (outline.startY < 0) {
      errors.push("Nut end margin places the fretboard cutout before the material.");
    }

    if (outline.endY > Number(input.materialLength)) {
      errors.push("Last fret end margin places the fretboard cutout beyond the material.");
    }

    if (
      outline.points.some(
        (point) =>
          point.x < 0 ||
          point.x > Number(input.materialWidth) ||
          point.y < 0 ||
          point.y > Number(input.materialLength),
      )
    ) {
      errors.push("Fretboard outline extends beyond the material.");
    }

    if (
      outline.cutterPath.some(
        (point) =>
          point.x < 0 ||
          point.x > Number(input.materialWidth) ||
          point.y < 0 ||
          point.y > Number(input.materialLength),
      )
    ) {
      errors.push("Cutout cutter path extends beyond the material.");
    }

    if (input.cutoutTabsEnabled) {
      if (!Number.isInteger(input.tabCount) || input.tabCount < 1) {
        errors.push("Tab count must be a whole number greater than zero.");
      }

      if (!Number.isFinite(Number(input.tabWidth)) || Number(input.tabWidth) <= 0) {
        errors.push("Tab width must be greater than zero.");
      }

      if (!Number.isFinite(Number(input.tabHeight)) || Number(input.tabHeight) <= 0) {
        errors.push("Tab height must be greater than zero.");
      }

      if (Number(input.tabHeight) >= Number(input.cutoutDepth)) {
        errors.push("Tab height must be smaller than cutout depth.");
      }

      const widestHalfWidth = Math.max(outline.nutWidth, outline.endWidth) / 2;
      const edgeDrop =
        widestHalfWidth < Number(input.fretboardRadius)
          ? radiusSagitta(input, layout, layout.centerX + widestHalfWidth)
          : 0;

      if (Number(input.tabHeight) <= edgeDrop) {
        warnings.push(
          "Radiusing the top before the cutout lowers the waste beside the board edge by the edge drop, which can remove the holding tabs; use a taller tab height.",
        );
      }
    }
  }

  if (includeRadius) {
    const outline = calculateFretboardOutline(input, layout);
    const toolRadius = Number(input.radiusBitDiameter) / 2;
    const narrowestWidth = Math.min(outline.nutWidth, outline.endWidth);
    const widestHalfWidth = Math.max(outline.nutWidth, outline.endWidth) / 2;
    const widestTravelSpan = widestHalfWidth + toolRadius;
    const maxSurfaceDepth =
      widestHalfWidth < Number(input.fretboardRadius)
        ? radiusSagitta(input, layout, layout.centerX + widestHalfWidth)
        : Number.POSITIVE_INFINITY;

    if (!includeCutout) {
      if (outline.startY < 0) {
        errors.push("Nut end margin places the radiusing area before the material.");
      }

      if (outline.endY > Number(input.materialLength)) {
        errors.push("Last fret end margin places the radiusing area beyond the material.");
      }

      if (
        outline.points.some(
          (point) =>
            point.x < 0 ||
            point.x > Number(input.materialWidth) ||
            point.y < 0 ||
            point.y > Number(input.materialLength),
        )
      ) {
        errors.push("Radiusing area extends beyond the material.");
      }
    }

    if (Number(input.radiusBitDiameter) >= narrowestWidth) {
      errors.push("Radiusing bit diameter must be smaller than the narrowest fretboard width.");
    }

    if (
      layout.centerX - widestTravelSpan < 0 ||
      layout.centerX + widestTravelSpan > Number(input.materialWidth)
    ) {
      errors.push(
        "Radiusing toolpath overhangs the board outline by the bit radius and extends beyond the material width.",
      );
    }

    if (widestHalfWidth >= Number(input.fretboardRadius)) {
      errors.push("Fretboard radius must be larger than half the widest fretboard width.");
    }

    if (Number(input.radiusStepOver) > Number(input.radiusBitDiameter)) {
      warnings.push("Radiusing step-over is larger than the cutter diameter and may leave ridges.");
    }

    if (maxSurfaceDepth >= Number(input.materialThickness)) {
      warnings.push("Fretboard radius edge removal is equal to or deeper than the material thickness.");
    }
  }

  if (includeMarkers && input.markersEnabled) {
    const markerFields: Array<[keyof FormState, string]> = [
      ["markerWidth", "Marker width"],
      ["markerDepth", "Marker depth"],
      ["markerDepthPerPass", "Marker depth per pass"],
      ["markerBitDiameter", "Marker bit diameter"],
      ["markerFeedRate", "Marker feed rate"],
      ["markerPlungeRate", "Marker plunge rate"],
      ["markerSpindleRpm", "Marker spindle RPM"],
    ];

    if (input.markerShape !== "dot") {
      markerFields.push(["markerLength", "Marker length"]);
    }

    if (input.markerShape === "trapezoid") {
      markerFields.push(["markerTopWidth", "Trapezoid top width"]);
    }

    const parsedMarkerAssignments = parseMarkerAssignments(input.markerFrets);
    const hasDoubleMarkers = parsedMarkerAssignments.assignments.some(
      (assignment) => assignment.count === 2,
    );

    if (hasDoubleMarkers) {
      markerFields.push(["doubleMarkerSpacing", "Double marker spacing"]);
    }

    for (const [key, label] of markerFields) {
      if (!Number.isFinite(Number(input[key])) || Number(input[key]) <= 0) {
        errors.push(`${label} must be greater than zero.`);
      }
    }

    if (parsedMarkerAssignments.assignments.length === 0) {
      errors.push("Choose at least one marker fret space.");
    }

    if (parsedMarkerAssignments.invalidTokens.length > 0) {
      errors.push("Marker map entries must use whole fret numbers with 1 or 2 markers.");
    }

    if (parsedMarkerAssignments.duplicateFrets.length > 0) {
      errors.push("Each marker fret space can only be listed once.");
    }

    const invalidFrets = parsedMarkerAssignments.assignments
      .map((assignment) => assignment.fretSpace)
      .filter((fretSpace) => fretSpace < 1 || fretSpace > input.fretCount);
    if (invalidFrets.length > 0) {
      errors.push("Marker fret spaces must be between 1 and the number of frets.");
    }

    if (Number(input.markerWidth) <= Number(input.markerBitDiameter)) {
      errors.push("Marker width must be larger than the marker bit diameter.");
    }

    if (
      input.markerShape !== "dot" &&
      Number(input.markerLength) <= Number(input.markerBitDiameter)
    ) {
      errors.push("Marker length must be larger than the marker bit diameter.");
    }

    if (
      input.markerShape === "trapezoid" &&
      Number(input.markerTopWidth) > Number(input.markerWidth)
    ) {
      errors.push("Trapezoid top width cannot be wider than marker width.");
    }

    if (Number(input.markerDepth) >= Number(input.materialThickness)) {
      warnings.push("Marker depth is equal to or deeper than the material thickness.");
    }

    const markers = calculateMarkers(input, layout);
    const halfMarkerWidth =
      hasDoubleMarkers
        ? Number(input.doubleMarkerSpacing) / 2 + Number(input.markerWidth) / 2
        : Number(input.markerWidth) / 2;
    const markerMaxOffset = Math.abs(Number(input.markerXOffset)) + halfMarkerWidth;

    if (markerMaxOffset > layout.maxFretboardWidth / 2) {
      warnings.push("Marker layout extends beyond the calculated fretboard outline.");
    }

    if (
      markerMaxOffset - Number(input.markerBitDiameter) / 2 >=
      Number(input.fretboardRadius)
    ) {
      errors.push(
        "Fretboard radius must be larger than the widest marker cutter offset from the centerline.",
      );
    }

    if (
      markers.some(
        (marker) =>
          marker.centerX - Number(input.markerWidth) / 2 < 0 ||
          marker.centerX + Number(input.markerWidth) / 2 > Number(input.materialWidth),
      )
    ) {
      errors.push("Marker pockets extend beyond the material width.");
    }
  }

  return { errors, warnings };
}

function zForRadius(input: FormState, layout: Layout, x: number, passDepth: number) {
  return -(passDepth + radiusSagitta(input, layout, x));
}

function markerShapeLabel(shape: MarkerShape) {
  return shape
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function addMarkerPocketGCode(
  lines: string[],
  input: FormState,
  layout: Layout,
  marker: MarkerPocket,
  passDepth: number,
) {
  const stepOver = Math.max(Number(input.markerBitDiameter) * 0.65, 0.001);
  const toolRadius = Math.max(Number(input.markerBitDiameter) / 2, 0.001);
  // Keep the innermost contour within one tool radius of the pocket center so
  // no uncut post is left standing there.
  const contourStep = Math.min(stepOver, toolRadius);

  if (input.markerShape === "dot") {
    const maxRadius = Math.max(
      Number(input.markerWidth) / 2 - Number(input.markerBitDiameter) / 2,
      0,
    );
    const contourCount = Math.max(1, Math.ceil(maxRadius / contourStep));
    const pointCount = 40;

    for (let contour = 1; contour <= contourCount; contour += 1) {
      const radius = maxRadius * (contour / contourCount);
      const startX = marker.centerX + radius;
      lines.push(
        contour === 1
          ? `G0 X${formatNumber(startX)} Y${formatNumber(marker.y)}`
          : `G1 X${formatNumber(startX)} Y${formatNumber(
              marker.y,
            )} F${formatNumber(input.markerFeedRate)}`,
      );
      lines.push(
        `G1 Z${formatNumber(
          zForRadius(input, layout, startX, passDepth),
        )} F${formatNumber(input.markerPlungeRate)}`,
      );

      for (let index = 1; index <= pointCount; index += 1) {
        const angle = (Math.PI * 2 * index) / pointCount;
        const x = marker.centerX + Math.cos(angle) * radius;
        const y = marker.y + Math.sin(angle) * radius;
        lines.push(
          `G1 X${formatNumber(x)} Y${formatNumber(y)} Z${formatNumber(
            zForRadius(input, layout, x, passDepth),
          )} F${formatNumber(input.markerFeedRate)}`,
        );
      }
    }
    return;
  }

  const polygon = markerPolygon(input, marker);
  const polygonCenter = polygonCentroid(polygon);
  const maxVertexDistance = polygon.reduce(
    (largest, point) => Math.max(largest, pointDistance(polygonCenter, point)),
    0,
  );
  const contourCount = Math.max(1, Math.ceil(maxVertexDistance / contourStep));

  for (let contour = 1; contour <= contourCount; contour += 1) {
    const points = scaledPolygon(polygon, contour / contourCount);
    const firstPoint = points[0];
    lines.push(
      contour === 1
        ? `G0 X${formatNumber(firstPoint.x)} Y${formatNumber(firstPoint.y)}`
        : `G1 X${formatNumber(firstPoint.x)} Y${formatNumber(
            firstPoint.y,
          )} F${formatNumber(input.markerFeedRate)}`,
    );
    lines.push(
      `G1 Z${formatNumber(
        zForRadius(input, layout, firstPoint.x, passDepth),
      )} F${formatNumber(input.markerPlungeRate)}`,
    );

    for (const point of points.slice(1)) {
      lines.push(
        `G1 X${formatNumber(point.x)} Y${formatNumber(point.y)} Z${formatNumber(
          zForRadius(input, layout, point.x, passDepth),
        )} F${formatNumber(input.markerFeedRate)}`,
      );
    }

    lines.push(
      `G1 X${formatNumber(firstPoint.x)} Y${formatNumber(
        firstPoint.y,
      )} Z${formatNumber(
        zForRadius(input, layout, firstPoint.x, passDepth),
      )} F${formatNumber(input.markerFeedRate)}`,
    );
  }
}

function addMarkerOperationGCode(
  lines: string[],
  input: FormState,
  layout: Layout,
  markers: MarkerPocket[],
  safeZ: number,
  stopCurrentSpindle: boolean,
) {
  const markerPasses = Math.ceil(
    Number(input.markerDepth) / Number(input.markerDepthPerPass),
  );

  lines.push(
    "",
    gCodeComment("Fretboard marker pocket operation"),
    gCodeComment(`Marker shape: ${markerShapeLabel(input.markerShape)}`),
    gCodeComment("Marker positions are centered in the numbered fret spaces."),
    `G0 Z${formatNumber(safeZ)}`,
  );

  if (stopCurrentSpindle) {
    lines.push(
      "M5",
      gCodeComment(
        "Tool change: install the marker cutter and reset Z0 at the centerline, then resume.",
      ),
      "M0",
    );
  }

  lines.push(`S${Math.round(Number(input.markerSpindleRpm))} M3`, ...spindleDwellLines);

  for (const marker of markers) {
    lines.push(
      "",
      gCodeComment(
        `Marker fret space ${marker.fretSpace}${
          marker.markerCount === 2
            ? ` ${marker.markerIndex} of ${marker.markerCount}`
            : ""
        } at X${formatNumber(marker.centerX)} Y${formatNumber(marker.y)}`,
      ),
    );

    for (let pass = 1; pass <= markerPasses; pass += 1) {
      const passDepth = Math.min(
        pass * Number(input.markerDepthPerPass),
        Number(input.markerDepth),
      );
      lines.push(
        gCodeComment(`Marker pass ${pass} depth ${formatNumber(passDepth)} ${input.unit}`),
      );
      lines.push(`G0 Z${formatNumber(safeZ)}`);
      addMarkerPocketGCode(lines, input, layout, marker, passDepth);
    }
  }
}

function pointDistance(start: Point, end: Point) {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

function interpolatePoint(start: Point, end: Point, ratio: number): Point {
  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio,
  };
}

function contourLength(points: Point[]) {
  return points.reduce((total, point, index) => {
    const nextPoint = points[(index + 1) % points.length];
    return total + pointDistance(point, nextPoint);
  }, 0);
}

function tabIntervals(points: Point[], input: FormState) {
  if (!input.cutoutTabsEnabled) {
    return [];
  }

  const length = contourLength(points);
  const tabCount = Math.max(0, Math.round(Number(input.tabCount)));
  const tabWidth = Number(input.tabWidth);

  return Array.from({ length: tabCount }, (_, index) => {
    const center = (length * (index + 0.5)) / tabCount;
    return {
      start: center - tabWidth / 2,
      end: center + tabWidth / 2,
    };
  });
}

function distanceIsTabbed(
  distanceAlongContour: number,
  intervals: Array<{ start: number; end: number }>,
) {
  return intervals.some(
    (interval) =>
      distanceAlongContour >= interval.start && distanceAlongContour <= interval.end,
  );
}

function addCutoutSegmentGCode(
  lines: string[],
  start: Point,
  end: Point,
  segmentStartDistance: number,
  intervals: Array<{ start: number; end: number }>,
  cutZ: number,
  tabZ: number,
  input: FormState,
) {
  const segmentLength = pointDistance(start, end);
  const breakpoints = new Set<number>([0, segmentLength]);

  for (const interval of intervals) {
    const tabStart = interval.start - segmentStartDistance;
    const tabEnd = interval.end - segmentStartDistance;

    if (tabStart > 0 && tabStart < segmentLength) {
      breakpoints.add(tabStart);
    }

    if (tabEnd > 0 && tabEnd < segmentLength) {
      breakpoints.add(tabEnd);
    }
  }

  const sortedBreakpoints = Array.from(breakpoints).sort((a, b) => a - b);

  for (let index = 0; index < sortedBreakpoints.length - 1; index += 1) {
    const fromDistance = sortedBreakpoints[index];
    const toDistance = sortedBreakpoints[index + 1];
    const midpoint = segmentStartDistance + (fromDistance + toDistance) / 2;
    const desiredZ = distanceIsTabbed(midpoint, intervals) ? tabZ : cutZ;
    const nextPoint = interpolatePoint(start, end, toDistance / segmentLength);

    lines.push(`G1 Z${formatNumber(desiredZ)} F${formatNumber(input.cutoutPlungeRate)}`);
    lines.push(
      `G1 X${formatNumber(nextPoint.x)} Y${formatNumber(
        nextPoint.y,
      )} Z${formatNumber(desiredZ)} F${formatNumber(input.cutoutFeedRate)}`,
    );
  }
}

// Dwell after starting the spindle so it reaches speed before the first cut.
const spindleDwellLines = [
  "(Dwell while the spindle reaches speed)",
  "G4 P2",
];

function endProgram(lines: string[], input: FormState) {
  const parkZ = input.unit === "mm" ? 25 : 1;
  lines.push(
    "",
    gCodeComment(
      `Park: retract to ${formatNumber(parkZ)} ${input.unit} above Z0 before returning over the origin. Confirm this clears your clamps.`,
    ),
    `G0 Z${formatNumber(parkZ)}`,
    "G0 X0 Y0",
    "M5",
    "M30",
    "%",
  );
}

function generateRadiusGCode(
  input: FormState,
  layout: Layout,
  extension: GCodeFileExtension,
) {
  const safeZ = input.unit === "mm" ? 5 : 0.2;
  const outline = calculateFretboardOutline(input, layout);
  const toolRadius = Number(input.radiusBitDiameter) / 2;
  const yStep = Math.max(Number(input.radiusStepOver), 0.001);
  const pointSpacing = input.unit === "mm" ? 1 : 0.04;
  const widestHalfWidth = Math.max(outline.nutWidth, outline.endWidth) / 2;
  const maxSurfaceDepth = radiusSagitta(
    input,
    layout,
    layout.centerX + widestHalfWidth,
  );
  // A flat cutter on a convex surface contacts at its inboard edge, not its
  // center; compensate Z so that edge follows the radius curve exactly.
  const contactZ = (x: number, passRatio: number) => {
    const contactOffset = Math.max(Math.abs(x - layout.centerX) - toolRadius, 0);
    return (
      -radiusSagitta(input, layout, layout.centerX + contactOffset) * passRatio
    );
  };
  const passes = Math.max(
    1,
    Math.ceil(maxSurfaceDepth / Number(input.radiusDepthPerPass)),
  );
  const rowCount = Math.max(
    1,
    Math.ceil((outline.endY - outline.startY) / yStep),
  );
  const lines: string[] = [
    "%",
    gCodeComment("Fretboard radius G-code generated by Fret Slot CNC Builder"),
    gCodeComment(`Program file: ${gCodeFilename(extension, "fretboard-radius")}`),
    gCodeComment(`Program type: ${gCodeFileTypeLabel(extension)}`),
    gCodeComment(`Units: ${input.unit === "mm" ? "millimeters" : "inches"}`),
    gCodeComment("Coordinate assumption: X0 Y0 is the lower-left front corner of the material."),
    gCodeComment("Z0 is the flat top surface at the fretboard centerline before radiusing."),
    gCodeComment("Final centerline remains at Z0 and the edges are cut down by the radius sagitta."),
    gCodeComment("Z is compensated so the cutter's inside edge follows the radius curve exactly."),
    gCodeComment("Rows overhang the board outline by the bit radius; adjacent waste is surfaced down by the edge drop."),
    gCodeComment("Run this program before cutting fret slots or marker pockets."),
    gCodeComment(`Fretboard top radius: ${formatNumber(input.fretboardRadius)} ${input.unit}`),
    gCodeComment(`Maximum edge removal: ${formatNumber(maxSurfaceDepth)} ${input.unit}`),
    gCodeComment(`Radiusing bit diameter: ${formatNumber(input.radiusBitDiameter)} ${input.unit}`),
    gCodeComment(`Step-over: ${formatNumber(input.radiusStepOver)} ${input.unit}`),
    input.unit === "mm" ? "G21" : "G20",
    "G90",
    "G17",
    "G94",
    "G54",
    `G0 Z${formatNumber(safeZ)}`,
    `S${Math.round(Number(input.radiusSpindleRpm))} M3`,
    ...spindleDwellLines,
  ];

  for (let pass = 1; pass <= passes; pass += 1) {
    const passSurfaceDepth = Math.min(
      pass * Number(input.radiusDepthPerPass),
      maxSurfaceDepth,
    );
    const passRatio = maxSurfaceDepth > 0 ? passSurfaceDepth / maxSurfaceDepth : 1;

    lines.push(
      "",
      gCodeComment(`Radius pass ${pass} max edge depth ${formatNumber(passSurfaceDepth)} ${input.unit}`),
    );

    for (let row = 0; row <= rowCount; row += 1) {
      const y = Math.min(outline.startY + row * yStep, outline.endY);
      const width = fretboardOutlineWidthAtY(outline, y);
      // Travel one tool radius past each board edge so the inboard cutting
      // edge reaches the full edge-drop depth at the outline.
      const travelHalfSpan = width / 2 + toolRadius;
      const leftX = layout.centerX - travelHalfSpan;
      const rightX = layout.centerX + travelHalfSpan;
      const startX = row % 2 === 0 ? leftX : rightX;
      const endX = row % 2 === 0 ? rightX : leftX;
      const sampleCount = Math.max(
        8,
        Math.min(180, Math.ceil(Math.abs(endX - startX) / pointSpacing)),
      );

      lines.push(`G0 Z${formatNumber(safeZ)}`);
      lines.push(`G0 X${formatNumber(startX)} Y${formatNumber(y)}`);
      lines.push(
        `G1 Z${formatNumber(
          contactZ(startX, passRatio),
        )} F${formatNumber(input.radiusPlungeRate)}`,
      );

      for (let index = 1; index <= sampleCount; index += 1) {
        const ratio = index / sampleCount;
        const x = startX + (endX - startX) * ratio;
        const z = contactZ(x, passRatio);
        lines.push(
          `G1 X${formatNumber(x)} Y${formatNumber(y)} Z${formatNumber(
            z,
          )} F${formatNumber(input.radiusFeedRate)}`,
        );
      }
    }
  }

  endProgram(lines, input);
  return lines.join("\n");
}

function generateCutoutGCode(
  input: FormState,
  layout: Layout,
  extension: GCodeFileExtension,
) {
  const safeZ = input.unit === "mm" ? 5 : 0.2;
  const outline = calculateFretboardOutline(input, layout);
  const points = outline.cutterPath;
  const passes = Math.ceil(Number(input.cutoutDepth) / Number(input.cutoutDepthPerPass));
  const intervals = tabIntervals(points, input);
  const tabProtectedDepth = Math.max(
    Number(input.cutoutDepth) - Number(input.tabHeight),
    0,
  );
  const lines: string[] = [
    "%",
    gCodeComment("Fretboard cutout G-code generated by Fret Slot CNC Builder"),
    gCodeComment(`Program file: ${gCodeFilename(extension, "fretboard-cutout")}`),
    gCodeComment(`Program type: ${gCodeFileTypeLabel(extension)}`),
    gCodeComment(`Units: ${input.unit === "mm" ? "millimeters" : "inches"}`),
    gCodeComment("Coordinate assumption: X0 Y0 is the lower-left front corner of the material."),
    gCodeComment("Z0 is the top surface before cutting the blank outline."),
    gCodeComment("Run this program before cutting fret slots or marker pockets."),
    gCodeComment(`Final outline: nut width ${formatNumber(outline.nutWidth)} ${input.unit}, end width ${formatNumber(outline.endWidth)} ${input.unit}`),
    gCodeComment(`Board length: ${formatNumber(outline.endY - outline.startY)} ${input.unit}`),
    gCodeComment(`Cutout bit diameter: ${formatNumber(input.cutoutBitDiameter)} ${input.unit}`),
    gCodeComment(`Cutout allowance: ${formatNumber(input.cutoutAllowance)} ${input.unit}`),
    gCodeComment(`Material: ${formatNumber(input.materialWidth)} x ${formatNumber(
      input.materialLength,
    )} x ${formatNumber(input.materialThickness)} ${input.unit}`),
    input.unit === "mm" ? "G21" : "G20",
    "G90",
    "G17",
    "G94",
    "G54",
    `G0 Z${formatNumber(safeZ)}`,
    `S${Math.round(Number(input.cutoutSpindleRpm))} M3`,
    ...spindleDwellLines,
  ];

  if (input.cutoutTabsEnabled) {
    lines.push(
      gCodeComment(
        `Tabs: ${Math.round(Number(input.tabCount))} at ${formatNumber(
          input.tabWidth,
        )} wide x ${formatNumber(input.tabHeight)} high`,
      ),
    );
  } else {
    lines.push(gCodeComment("Tabs disabled"));
  }

  for (let pass = 1; pass <= passes; pass += 1) {
    const passDepth = Math.min(
      pass * Number(input.cutoutDepthPerPass),
      Number(input.cutoutDepth),
    );
    const cutZ = -passDepth;
    const tabZ = input.cutoutTabsEnabled
      ? -Math.min(passDepth, tabProtectedDepth)
      : cutZ;
    let segmentStartDistance = 0;

    lines.push(
      "",
      gCodeComment(`Cutout pass ${pass} depth ${formatNumber(passDepth)} ${input.unit}`),
      `G0 Z${formatNumber(safeZ)}`,
      `G0 X${formatNumber(points[0].x)} Y${formatNumber(points[0].y)}`,
      `G1 Z${formatNumber(cutZ)} F${formatNumber(input.cutoutPlungeRate)}`,
    );

    for (let index = 0; index < points.length; index += 1) {
      const start = points[index];
      const end = points[(index + 1) % points.length];
      addCutoutSegmentGCode(
        lines,
        start,
        end,
        segmentStartDistance,
        intervals,
        cutZ,
        tabZ,
        input,
      );
      segmentStartDistance += pointDistance(start, end);
    }
  }

  endProgram(lines, input);
  return lines.join("\n");
}

function generateGCode(
  input: FormState,
  layout: Layout,
  extension: GCodeFileExtension,
) {
  const safeZ = input.unit === "mm" ? 5 : 0.2;
  const plungeFeed = Math.max(input.feedRate * 0.45, input.unit === "mm" ? 25 : 1);
  const pointSpacing = input.unit === "mm" ? 1 : 0.04;
  const passes = Math.ceil(input.slotDepth / input.depthPerPass);
  const markers = calculateMarkers(input, layout);
  const lines: string[] = [
    "%",
    gCodeComment("Fret slot G-code generated by Fret Slot CNC Builder"),
    gCodeComment(`Program file: ${gCodeFilename(extension, "fret-slots")}`),
    gCodeComment(`Program type: ${gCodeFileTypeLabel(extension)}`),
    gCodeComment(`Units: ${input.unit === "mm" ? "millimeters" : "inches"}`),
    gCodeComment("Coordinate assumption: X0 Y0 is the lower-left front corner of the material."),
    gCodeComment("Z0 is the fretboard top surface at the centerline before slot cutting."),
    gCodeComment("Fret positions use the 12-tone equal temperament formula."),
    gCodeComment("String spread is interpolated from nut spread to bridge spread."),
    gCodeComment("Slot bottom follows the fretboard radius sagitta."),
    gCodeComment(`Material: ${formatNumber(input.materialWidth)} x ${formatNumber(
      input.materialLength,
    )} x ${formatNumber(input.materialThickness)} ${input.unit}`),
    gCodeComment(`Bit diameter: ${formatNumber(input.bitDiameter)} ${input.unit}`),
    input.unit === "mm" ? "G21" : "G20",
    "G90",
    "G17",
    "G94",
    "G54",
    `G0 Z${formatNumber(safeZ)}`,
    `S${Math.round(input.spindleRpm)} M3`,
    ...spindleDwellLines,
  ];

  for (const slot of layout.slots) {
    const sampleCount = Math.max(
      8,
      Math.min(140, Math.ceil((slot.endX - slot.startX) / pointSpacing)),
    );

    lines.push(
      "",
      gCodeComment(`Fret ${slot.fret}: scale position ${formatNumber(
        slot.scalePosition,
      )} ${input.unit}, Y ${formatNumber(slot.y)} ${input.unit}`),
      gCodeComment(`Final slot length ${formatNumber(slot.slotLength)} ${input.unit}; cutter center X ${formatNumber(
        slot.startX,
      )} to ${formatNumber(slot.endX)}`),
    );

    for (let pass = 1; pass <= passes; pass += 1) {
      const passDepth = Math.min(pass * input.depthPerPass, input.slotDepth);
      lines.push(gCodeComment(`Pass ${pass} depth ${formatNumber(passDepth)} ${input.unit}`));
      lines.push(`G0 Z${formatNumber(safeZ)}`);
      lines.push(`G0 X${formatNumber(slot.startX)} Y${formatNumber(slot.y)}`);
      lines.push(
        `G1 Z${formatNumber(
          zForRadius(input, layout, slot.startX, passDepth),
        )} F${formatNumber(plungeFeed)}`,
      );

      for (let index = 1; index <= sampleCount; index += 1) {
        const ratio = index / sampleCount;
        const x = slot.startX + (slot.endX - slot.startX) * ratio;
        const z = zForRadius(input, layout, x, passDepth);
        lines.push(
          `G1 X${formatNumber(x)} Y${formatNumber(slot.y)} Z${formatNumber(
            z,
          )} F${formatNumber(input.feedRate)}`,
        );
      }
    }
  }

  if (input.markersEnabled && markers.length > 0) {
    addMarkerOperationGCode(lines, input, layout, markers, safeZ, true);
  }

  endProgram(lines, input);
  return lines.join("\n");
}

function generateMarkerGCode(
  input: FormState,
  layout: Layout,
  extension: GCodeFileExtension,
) {
  const safeZ = input.unit === "mm" ? 5 : 0.2;
  const markers = calculateMarkers(input, layout);
  const lines: string[] = [
    "%",
    gCodeComment("Fretboard marker G-code generated by Fret Slot CNC Builder"),
    gCodeComment(`Program file: ${gCodeFilename(extension, "fretboard-markers")}`),
    gCodeComment(`Program type: ${gCodeFileTypeLabel(extension)}`),
    gCodeComment(`Units: ${input.unit === "mm" ? "millimeters" : "inches"}`),
    gCodeComment("Coordinate assumption: X0 Y0 is the lower-left front corner of the material."),
    gCodeComment("Z0 is the fretboard top surface at the centerline before marker cutting."),
    gCodeComment("Run this program after installing the marker cutter and setting work zero."),
    gCodeComment(`Marker bit diameter: ${formatNumber(input.markerBitDiameter)} ${input.unit}`),
    gCodeComment(`Material: ${formatNumber(input.materialWidth)} x ${formatNumber(
      input.materialLength,
    )} x ${formatNumber(input.materialThickness)} ${input.unit}`),
    input.unit === "mm" ? "G21" : "G20",
    "G90",
    "G17",
    "G94",
    "G54",
    `G0 Z${formatNumber(safeZ)}`,
  ];

  addMarkerOperationGCode(lines, input, layout, markers, safeZ, false);

  endProgram(lines, input);
  return lines.join("\n");
}

function reportExportError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return;
  }
  window.alert(
    error instanceof Error ? error.message : "Failed to generate the G-code file.",
  );
}

async function saveGCode(
  gcode: string,
  extension: GCodeFileExtension,
  program: GCodeProgram,
) {
  const blob = new Blob([gcode], { type: "text/plain;charset=utf-8" });
  const filename = gCodeFilename(extension, program);
  const savePicker = (
    window as unknown as {
      showSaveFilePicker?: (options: {
        suggestedName: string;
        types: Array<{
          description: string;
          accept: Record<string, string[]>;
        }>;
      }) => Promise<{
        createWritable: () => Promise<{
          write: (data: Blob) => Promise<void>;
          close: () => Promise<void>;
        }>;
      }>;
    }
  ).showSaveFilePicker;

  if (savePicker) {
    const handle = await savePicker({
      suggestedName: filename,
      types: [
        {
          description: "G-code file",
          accept: {
            "text/plain": gCodeFileExtensions,
          },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

type FieldGroup = {
  title: string;
  stepLabel: string;
  summary: string;
  fields: Array<{
    key: keyof FormState;
    label: string;
    step?: string;
    min?: string;
  }>;
};

const sharedFieldGroups: FieldGroup[] = [
  {
    title: "Scale And Frets",
    stepLabel: "Shared",
    summary: "Shared fret spacing data used by any operation that references fret positions.",
    fields: [
      { key: "scaleLength", label: "Scale length", step: "0.001", min: "0" },
      { key: "fretCount", label: "Number of frets", step: "1", min: "1" },
    ],
  },
  {
    title: "Fretboard Layout",
    stepLabel: "Shared",
    summary: "Shared board shape, top radius, and board-end margins.",
    fields: [
      {
        key: "nutStringSpread",
        label: "String spread at nut",
        step: "0.001",
        min: "0",
      },
      {
        key: "bridgeStringSpread",
        label: "String spread at bridge",
        step: "0.001",
        min: "0",
      },
      {
        key: "fretboardOverhang",
        label: "Fretboard overhang (each side)",
        step: "0.001",
        min: "0",
      },
      {
        key: "fretboardRadius",
        label: "Fretboard top radius",
        step: "0.001",
        min: "0",
      },
      {
        key: "nutEndMargin",
        label: "Nut end margin",
        step: "0.001",
        min: "0",
      },
      {
        key: "lastFretEndMargin",
        label: "Last fret end margin",
        step: "0.001",
        min: "0",
      },
    ],
  },
  {
    title: "Material",
    stepLabel: "Shared",
    summary: "Physical stock dimensions used for each operation's validation and preview.",
    fields: [
      { key: "materialWidth", label: "Material width", step: "0.001", min: "0" },
      {
        key: "materialLength",
        label: "Material length",
        step: "0.001",
        min: "0",
      },
      {
        key: "materialThickness",
        label: "Material thickness",
        step: "0.001",
        min: "0",
      },
    ],
  },
];

const slotFields: FieldGroup["fields"] = [
  { key: "fretInset", label: "Fret inset (each side)", step: "0.001", min: "0" },
  { key: "bitDiameter", label: "Slot cutter diameter", step: "0.001", min: "0" },
  { key: "slotDepth", label: "Fret slot depth", step: "0.001", min: "0" },
  { key: "feedRate", label: "Slot feed rate", step: "0.1", min: "0" },
  { key: "depthPerPass", label: "Slot depth per pass", step: "0.001", min: "0" },
  { key: "spindleRpm", label: "Slot spindle RPM", step: "1", min: "0" },
];

function FieldLabel({
  label,
  description,
}: {
  label: string;
  description?: string;
}) {
  const [tooltip, setTooltip] = useState<{
    left: number;
    top: number;
    below: boolean;
  } | null>(null);

  if (!description) {
    return <span>{label}</span>;
  }

  return (
    <span className="inline-flex w-fit items-center">
      <span
        className="cursor-help underline decoration-[#9fb3bd] decoration-dotted underline-offset-4"
        onMouseEnter={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const below = rect.top < 140;
          setTooltip({
            left: clamp(rect.left, 8, Math.max(window.innerWidth - 280, 8)),
            top: below ? rect.bottom + 8 : rect.top - 8,
            below,
          });
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        {label}
      </span>
      {tooltip ? (
        <span
          className={`pointer-events-none fixed z-50 w-[264px] rounded-md border border-[#39474e] bg-[#1f2523] px-3 py-2 text-xs font-normal normal-case leading-snug tracking-normal text-white shadow-lg ${
            tooltip.below ? "" : "-translate-y-full"
          }`}
          style={{ left: tooltip.left, top: tooltip.top }}
        >
          {description}
        </span>
      ) : null}
    </span>
  );
}

function CollapsiblePanel({
  title,
  stepLabel,
  summary,
  defaultOpen = true,
  accent = "teal",
  actions,
  children,
}: {
  title: string;
  stepLabel: string;
  summary: string;
  defaultOpen?: boolean;
  accent?: "teal" | "blue" | "brown" | "slate";
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const accentClasses = {
    teal: {
      border: "border-l-[#19695f]",
      badge: "bg-[#dcebe2] text-[#14544c]",
      button: "text-[#14544c]",
    },
    blue: {
      border: "border-l-[#2f5d7c]",
      badge: "bg-[#e1ecf4] text-[#264c66]",
      button: "text-[#264c66]",
    },
    brown: {
      border: "border-l-[#8a4f1f]",
      badge: "bg-[#f4e6d8] text-[#724018]",
      button: "text-[#724018]",
    },
    slate: {
      border: "border-l-[#60717b]",
      badge: "bg-[#e8eef2] text-[#39474e]",
      button: "text-[#39474e]",
    },
  }[accent];

  return (
    <section
      className={`overflow-hidden rounded-lg border border-[#c7d1d8] border-l-4 ${accentClasses.border} bg-white shadow-sm`}
    >
      <div className="grid gap-3 border-b border-[#d6dde2] bg-[#f9fbfc] p-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <button
          type="button"
          className="grid min-w-0 gap-1 text-left"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
        >
          <span
            className={`w-fit rounded-[4px] px-2 py-0.5 text-xs font-bold uppercase tracking-[0.12em] ${accentClasses.badge}`}
          >
            {stepLabel}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <span className="text-lg font-semibold text-[#1f2523]">{title}</span>
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] border border-[#c7d1d8] bg-white text-sm font-bold ${accentClasses.button}`}
              aria-hidden="true"
            >
              {isOpen ? "-" : "+"}
            </span>
          </span>
          <span className="text-sm leading-snug text-[#53616a]">{summary}</span>
        </button>
        {actions ? <div className="sm:justify-self-end">{actions}</div> : null}
      </div>
      {isOpen ? <div className="p-3">{children}</div> : null}
    </section>
  );
}

export default function Home() {
  const [form, setForm] = useState<FormState>(defaultMetricState);
  const [fileExtension, setFileExtension] =
    useState<GCodeFileExtension>(".nc");
  const [highlightTarget, setHighlightTarget] =
    useState<HighlightTarget | null>(null);
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [profileName, setProfileName] = useState("");
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);

  // Restoring after mount keeps the static prerender free of hydration
  // mismatches; storage values only exist in the browser.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const storedSession = window.localStorage.getItem(lastSessionStorageKey);
      if (storedSession) {
        const parsedSession = JSON.parse(storedSession) as Record<string, unknown>;
        const restoredForm = sanitizeFormState(parsedSession.form);
        const restoredExtension = sanitizeFileExtension(parsedSession.fileExtension);
        if (restoredForm) {
          setForm(restoredForm);
        }
        if (restoredExtension) {
          setFileExtension(restoredExtension);
        }
      }

      const storedProfiles = window.localStorage.getItem(profilesStorageKey);
      if (storedProfiles) {
        setProfiles(sanitizeProfiles(JSON.parse(storedProfiles)));
      }
    } catch {
      // Ignore unreadable storage and fall back to defaults.
    }
    setIsStorageLoaded(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!isStorageLoaded) {
      return;
    }
    try {
      window.localStorage.setItem(
        lastSessionStorageKey,
        JSON.stringify({ form, fileExtension }),
      );
    } catch {
      // Storage may be full or blocked; keep the app usable.
    }
  }, [form, fileExtension, isStorageLoaded]);

  useEffect(() => {
    if (!isStorageLoaded) {
      return;
    }
    try {
      window.localStorage.setItem(profilesStorageKey, JSON.stringify(profiles));
    } catch {
      // Storage may be full or blocked; keep the app usable.
    }
  }, [profiles, isStorageLoaded]);

  const layout = useMemo(() => calculateLayout(form), [form]);
  const fretboardOutline = useMemo(
    () => calculateFretboardOutline(form, layout),
    [form, layout],
  );
  const markerAssignments = useMemo(
    () => parseMarkerAssignments(form.markerFrets).assignments,
    [form.markerFrets],
  );
  const markerCountByFret = useMemo(
    () =>
      new Map(
        markerAssignments.map((assignment) => [
          assignment.fretSpace,
          assignment.count,
        ]),
      ),
    [markerAssignments],
  );
  const markers = useMemo(() => calculateMarkers(form, layout), [form, layout]);
  const fretValidation = useMemo(
    () => getValidationMessages(form, layout, true, false, false),
    [form, layout],
  );
  const cutoutValidation = useMemo(
    () => getValidationMessages(form, layout, false, true, false, false),
    [form, layout],
  );
  const radiusValidation = useMemo(
    () => getValidationMessages(form, layout, false, false, true, false),
    [form, layout],
  );
  const markerValidation = useMemo(
    () => getValidationMessages(form, layout, true, false, false, false),
    [form, layout],
  );
  const canGenerate = fretValidation.errors.length === 0;
  const canGenerateCutout = cutoutValidation.errors.length === 0;
  const canGenerateRadius = radiusValidation.errors.length === 0;
  const canGenerateMarkers =
    markerValidation.errors.length === 0 && form.markersEnabled && markers.length > 0;
  const markerExportValidation =
    form.markersEnabled && markers.length > 0
      ? markerValidation
      : {
          errors: ["Enable at least one marker pocket to export markers."],
          warnings: markerValidation.warnings,
        };
  const validationGroups = [
    { label: "Radius Top", validation: radiusValidation },
    { label: "Cutout Only", validation: cutoutValidation },
    { label: form.markersEnabled ? "Frets + Markers" : "Fret Slots", validation: fretValidation },
    { label: "Markers Only", validation: markerExportValidation },
  ];

  const preview = useMemo(() => {
    const width = 720;
    const height = 420;
    const pad = 24;
    const materialRatio = form.materialWidth / form.materialLength;
    const drawingHeight = height - pad * 2;
    const drawingWidth = Math.min(width - pad * 2, drawingHeight * materialRatio);
    const originX = (width - drawingWidth) / 2;
    const originY = pad;
    const scaleX = drawingWidth / form.materialWidth;
    const scaleY = drawingHeight / form.materialLength;

    return {
      width,
      height,
      drawingWidth,
      drawingHeight,
      originX,
      originY,
      scaleX,
      scaleY,
    };
  }, [form.materialLength, form.materialWidth]);

  const radiusPreview = useMemo(() => {
    const width = 720;
    const height = 220;
    const padX = 44;
    const topY = 48;
    const bottomY = 166;
    const boardWidth = Math.max(fretboardOutline.nutWidth, fretboardOutline.endWidth);
    const halfBoardWidth = boardWidth / 2;
    const usableWidth = width - padX * 2;
    const xScale = usableWidth / Math.max(boardWidth, 0.000001);
    const edgeDrop =
      halfBoardWidth < Number(form.fretboardRadius)
        ? radiusSagitta(form, layout, layout.centerX + halfBoardWidth)
        : 0;
    const zScale = edgeDrop > 0 ? (bottomY - topY) / edgeDrop : 1;
    const centerX = width / 2;
    const points = Array.from({ length: 65 }, (_, index) => {
      const ratio = index / 64;
      const xFromCenter = -halfBoardWidth + boardWidth * ratio;
      const sagitta =
        halfBoardWidth < Number(form.fretboardRadius)
          ? radiusSagitta(form, layout, layout.centerX + xFromCenter)
          : 0;

      return {
        x: centerX + xFromCenter * xScale,
        y: topY + sagitta * zScale,
      };
    });
    const verticalExaggeration = zScale / xScale;

    return {
      width,
      height,
      topY,
      bottomY,
      centerX,
      leftX: centerX - halfBoardWidth * xScale,
      rightX: centerX + halfBoardWidth * xScale,
      boardWidth,
      edgeDrop,
      verticalExaggeration,
      points,
    };
  }, [form, fretboardOutline.endWidth, fretboardOutline.nutWidth, layout]);

  function updateField(key: keyof FormState, value: string) {
    setForm((current) => {
      if (key === "unit") {
        return convertUnits(current, value as Unit);
      }

      if (key === "markerShape" || key === "markerFrets") {
        return {
          ...current,
          [key]: value,
        };
      }

      if (value === "") {
        return {
          ...current,
          [key]: "",
        };
      }

      const numericValue =
        key === "fretCount" ||
        key === "spindleRpm" ||
        key === "radiusSpindleRpm" ||
        key === "cutoutSpindleRpm" ||
        key === "tabCount"
          ? Math.round(Number(value))
          : Number(value);

      return {
        ...current,
        [key]: Number.isFinite(numericValue) ? numericValue : 0,
      };
    });
  }

  function fieldHoverProps(key: string) {
    const target = fieldHighlightTargets[key];
    if (!target) {
      return {};
    }

    return {
      onMouseEnter: () => setHighlightTarget(target),
      onMouseLeave: () => setHighlightTarget(null),
    };
  }

  function updateBooleanField(key: keyof FormState, value: boolean) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateMarkerCount(fretSpace: number, count: 0 | MarkerCount) {
    setForm((current) => {
      const assignments = parseMarkerAssignments(current.markerFrets).assignments
        .filter((assignment) => assignment.fretSpace !== fretSpace);

      if (count !== 0) {
        assignments.push({ fretSpace, count });
      }

      return {
        ...current,
        markerFrets: formatMarkerAssignments(assignments),
      };
    });
  }

  function handleSaveProfile() {
    const name = profileName.trim();
    if (!name) {
      return;
    }

    setProfiles((current) => {
      const next = current.filter((profile) => profile.name !== name);
      next.push({ name, form, fileExtension });
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  function handleLoadProfile(profile: SavedProfile) {
    setForm(profile.form);
    setFileExtension(profile.fileExtension);
    setProfileName(profile.name);
  }

  function handleDeleteProfile(name: string) {
    setProfiles((current) => current.filter((profile) => profile.name !== name));
  }

  async function handleGenerate() {
    if (!canGenerate) {
      return;
    }

    try {
      await saveGCode(
        generateGCode(form, layout, fileExtension),
        fileExtension,
        "fret-slots",
      );
    } catch (error) {
      reportExportError(error);
    }
  }

  async function handleGenerateCutout() {
    if (!canGenerateCutout) {
      return;
    }

    try {
      await saveGCode(
        generateCutoutGCode(form, layout, fileExtension),
        fileExtension,
        "fretboard-cutout",
      );
    } catch (error) {
      reportExportError(error);
    }
  }

  async function handleGenerateRadius() {
    if (!canGenerateRadius) {
      return;
    }

    try {
      await saveGCode(
        generateRadiusGCode(form, layout, fileExtension),
        fileExtension,
        "fretboard-radius",
      );
    } catch (error) {
      reportExportError(error);
    }
  }

  async function handleGenerateMarkers() {
    if (!canGenerateMarkers) {
      return;
    }

    try {
      await saveGCode(
        generateMarkerGCode(form, layout, fileExtension),
        fileExtension,
        "fretboard-markers",
      );
    } catch (error) {
      reportExportError(error);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-[#1f2523]">
      <nav className="sticky top-0 z-40 border-b border-[#c7d1d8] bg-white shadow-sm">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2 px-4 py-2 sm:px-6 lg:px-8">
          <span className="shrink-0 text-xs font-bold uppercase tracking-[0.12em] text-[#8a4f1f]">
            Cut profiles
          </span>
          <input
            className="h-9 w-44 rounded-md border border-[#c7d1d8] bg-white px-3 text-sm text-[#1f2523] outline-none transition focus:border-[#19695f] focus:ring-2 focus:ring-[#19695f]/20"
            type="text"
            placeholder='Name, e.g. "Fretboard 1"'
            value={profileName}
            onChange={(event) => setProfileName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSaveProfile();
              }
            }}
          />
          <button
            type="button"
            className="h-9 shrink-0 rounded-md bg-[#19695f] px-3 text-sm font-semibold text-white transition hover:bg-[#14544c] disabled:cursor-not-allowed disabled:bg-[#9ca49b]"
            disabled={!profileName.trim()}
            onClick={handleSaveProfile}
          >
            {profiles.some((profile) => profile.name === profileName.trim())
              ? "Update"
              : "Save"}
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1">
            {profiles.length === 0 ? (
              <span className="whitespace-nowrap text-xs text-[#77838a]">
                No saved profiles yet — name and save your current setup.
              </span>
            ) : (
              profiles.map((profile) => (
                <span
                  key={profile.name}
                  className="flex shrink-0 items-stretch overflow-hidden rounded-md border border-[#c7d1d8] bg-[#f7fafb]"
                >
                  <button
                    type="button"
                    className="max-w-48 truncate px-3 py-1.5 text-sm font-semibold text-[#26302f] transition hover:bg-[#e8eef2]"
                    title={`Load "${profile.name}" (${
                      profile.form.unit
                    }, ${numberFormatter.format(
                      Number(profile.form.scaleLength) || 0,
                    )} scale)`}
                    onClick={() => handleLoadProfile(profile)}
                  >
                    {profile.name}
                  </button>
                  <button
                    type="button"
                    className="border-l border-[#d6dde2] px-2 text-sm font-semibold text-[#77838a] transition hover:bg-[#fbeae6] hover:text-[#a94432]"
                    aria-label={`Delete profile ${profile.name}`}
                    title={`Delete "${profile.name}"`}
                    onClick={() => handleDeleteProfile(profile.name)}
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
        </div>
      </nav>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <section className="grid gap-5 lg:grid-cols-[minmax(330px,420px)_1fr]">
          <div className="flex flex-col gap-4">
            <section className="rounded-lg border border-[#c7d1d8] bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8a4f1f]">
                  CNC fretboard generator
                </p>
                <h1 className="text-3xl font-semibold leading-tight text-[#1f2523]">
                  Fretboard radius and slot G-code
                </h1>
              </div>

              <div className="mt-4 grid grid-cols-2 rounded-md border border-[#c7d1d8] bg-[#e8eef2] p-1">
                {(["mm", "in"] as const).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    className={`h-10 rounded-[4px] text-sm font-semibold transition ${
                      form.unit === unit
                        ? "bg-[#19695f] text-white shadow-sm"
                        : "text-[#26302f] hover:bg-white/70"
                    }`}
                    onClick={() => updateField("unit", unit)}
                  >
                    {unit === "mm" ? "Millimeters" : "Inches"}
                  </button>
                ))}
              </div>
            </section>

            <div className="grid gap-4">
              <CollapsiblePanel
                title="Shared Board Setup"
                stepLabel="Shared"
                summary="Geometry, fret spacing, top radius, and material data used across operations."
                accent="teal"
              >
                <div className="grid gap-3">
                  {sharedFieldGroups.map((group) => (
                    <section
                      key={group.title}
                      className="overflow-hidden rounded-md border border-[#d6dde2] bg-[#f7fafb]"
                    >
                      <div className="border-b border-[#d6dde2] bg-white px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-[4px] bg-[#e8eef2] px-2 py-0.5 text-xs font-bold uppercase tracking-[0.1em] text-[#53616a]">
                            {group.stepLabel}
                          </span>
                          <h3 className="text-sm font-semibold text-[#1f2523]">
                            {group.title}
                          </h3>
                        </div>
                        <p className="mt-1 text-xs leading-snug text-[#53616a]">
                          {group.summary}
                        </p>
                      </div>
                      <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                        {group.fields.map((field) => (
                          <label
                            key={field.key}
                            className="grid gap-1 text-sm font-medium text-[#26302f]"
                            {...fieldHoverProps(field.key)}
                          >
                            <FieldLabel
                              label={field.label}
                              description={fieldDescriptions[field.key]}
                            />
                            <input
                              className="h-10 rounded-md border border-[#c7d1d8] bg-white px-3 text-base text-[#1f2523] outline-none transition focus:border-[#19695f] focus:ring-2 focus:ring-[#19695f]/20"
                              type="number"
                              min={field.min}
                              step={field.step}
                              value={form[field.key] as string | number}
                              onChange={(event) =>
                                updateField(field.key, event.target.value)
                              }
                            />
                          </label>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </CollapsiblePanel>

              <CollapsiblePanel
                title="Fret Slots"
                stepLabel="Slots"
                summary="Standalone fret-slot settings for Fret Slots or Frets + Markers exports."
                accent="teal"
              >
                <div className="mb-3 rounded-md border border-[#d6dde2] bg-[#f7fafb] px-3 py-2 text-sm leading-snug text-[#53616a]">
                  Uses the shared fret positions, board width, and fretboard top radius. These
                  slot inset, cutter, depth, and feed settings are only required for slot exports.
                  Slot bottoms follow the selected top radius.
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {slotFields.map((field) => (
                    <label
                      key={field.key}
                      className="grid gap-1 text-sm font-medium text-[#26302f]"
                      {...fieldHoverProps(field.key)}
                    >
                      <FieldLabel
                              label={field.label}
                              description={fieldDescriptions[field.key]}
                            />
                      <input
                        className="h-10 rounded-md border border-[#c7d1d8] bg-white px-3 text-base text-[#1f2523] outline-none transition focus:border-[#19695f] focus:ring-2 focus:ring-[#19695f]/20"
                        type="number"
                        min={field.min}
                        step={field.step}
                        value={form[field.key] as string | number}
                        onChange={(event) => updateField(field.key, event.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </CollapsiblePanel>

              <CollapsiblePanel
                title="Fretboard Cutout"
                stepLabel="Cutout"
                summary="Standalone outline profiling settings; does not use radius or slot cutter settings."
                accent="blue"
              >
                <div className="mb-3 rounded-md border border-[#d6dde2] bg-[#f7fafb] px-3 py-2 text-sm leading-snug text-[#53616a]">
                  Uses the shared board shape above. These cutter, depth, tab, and feed settings
                  are only required for the cutout export.
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {[
                    ["cutoutBitDiameter", "Cutout bit diameter"],
                    ["cutoutDepth", "Cutout depth"],
                    ["cutoutDepthPerPass", "Depth per pass"],
                    ["cutoutFeedRate", "Feed rate"],
                    ["cutoutPlungeRate", "Plunge rate"],
                    ["cutoutSpindleRpm", "Spindle RPM"],
                    ["cutoutAllowance", "Outside allowance"],
                  ].map(([key, label]) => (
                    <label
                      key={key}
                      className="grid gap-1 text-sm font-medium text-[#26302f]"
                      {...fieldHoverProps(key)}
                    >
                      <FieldLabel label={label} description={fieldDescriptions[key]} />
                      <input
                        className="h-10 rounded-md border border-[#c7d1d8] bg-white px-3 text-base text-[#1f2523] outline-none transition focus:border-[#19695f] focus:ring-2 focus:ring-[#19695f]/20"
                        type="number"
                        min={key === "cutoutAllowance" ? "0" : "0.001"}
                        step={key === "cutoutSpindleRpm" ? "1" : "0.001"}
                        value={form[key as keyof FormState] as string | number}
                        onChange={(event) =>
                          updateField(key as keyof FormState, event.target.value)
                        }
                      />
                    </label>
                  ))}

                  <label
                    className="flex items-center gap-2 text-sm font-semibold text-[#26302f] sm:col-span-2 lg:col-span-1 xl:col-span-2"
                    {...fieldHoverProps("cutoutTabsEnabled")}
                  >
                    <input
                      className="h-4 w-4 accent-[#19695f]"
                      type="checkbox"
                      checked={form.cutoutTabsEnabled}
                      onChange={(event) =>
                        updateBooleanField(
                          "cutoutTabsEnabled",
                          event.target.checked,
                        )
                      }
                    />
                    <FieldLabel
                      label="Leave holding tabs"
                      description={fieldDescriptions.cutoutTabsEnabled}
                    />
                  </label>

                  {[
                    ["tabCount", "Tab count"],
                    ["tabWidth", "Tab width"],
                    ["tabHeight", "Tab height"],
                  ].map(([key, label]) => (
                    <label
                      key={key}
                      className="grid gap-1 text-sm font-medium text-[#26302f]"
                      {...fieldHoverProps(key)}
                    >
                      <FieldLabel label={label} description={fieldDescriptions[key]} />
                      <input
                        className="h-10 rounded-md border border-[#c7d1d8] bg-white px-3 text-base text-[#1f2523] outline-none transition focus:border-[#19695f] focus:ring-2 focus:ring-[#19695f]/20 disabled:bg-[#eef2f4] disabled:text-[#77838a]"
                        type="number"
                        min="0"
                        step={key === "tabCount" ? "1" : "0.001"}
                        disabled={!form.cutoutTabsEnabled}
                        value={form[key as keyof FormState] as string | number}
                        onChange={(event) =>
                          updateField(key as keyof FormState, event.target.value)
                        }
                      />
                    </label>
                  ))}
                </div>
              </CollapsiblePanel>

              <CollapsiblePanel
                title="Fretboard Radius"
                stepLabel="Surface"
                summary="Standalone top-radius surfacing settings; does not use cutout or slot cutter settings."
                accent="teal"
                defaultOpen={false}
              >
                <div className="mb-3 rounded-md border border-[#d6dde2] bg-[#f7fafb] px-3 py-2 text-sm leading-snug text-[#53616a]">
                  Uses the shared board width, end margins, material, and fretboard top radius.
                  These radiusing cutter and feed settings are only required for the Radius Top export.
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {[
                    ["radiusBitDiameter", "Radiusing bit diameter"],
                    ["radiusStepOver", "Y step-over"],
                    ["radiusDepthPerPass", "Max depth per pass"],
                    ["radiusFeedRate", "Feed rate"],
                    ["radiusPlungeRate", "Plunge rate"],
                    ["radiusSpindleRpm", "Spindle RPM"],
                  ].map(([key, label]) => (
                    <label
                      key={key}
                      className="grid gap-1 text-sm font-medium text-[#26302f]"
                      {...fieldHoverProps(key)}
                    >
                      <FieldLabel label={label} description={fieldDescriptions[key]} />
                      <input
                        className="h-10 rounded-md border border-[#c7d1d8] bg-white px-3 text-base text-[#1f2523] outline-none transition focus:border-[#19695f] focus:ring-2 focus:ring-[#19695f]/20"
                        type="number"
                        min="0.001"
                        step={key === "radiusSpindleRpm" ? "1" : "0.001"}
                        value={form[key as keyof FormState] as string | number}
                        onChange={(event) =>
                          updateField(key as keyof FormState, event.target.value)
                        }
                      />
                    </label>
                  ))}
                </div>
              </CollapsiblePanel>

              <CollapsiblePanel
                title="Fretboard Markers"
                stepLabel="Markers"
                summary="Standalone marker-pocket settings; can be exported without slot or cutout settings."
                accent="brown"
                defaultOpen={false}
              >
                <div className="mb-3 rounded-md border border-[#d6dde2] bg-[#f7fafb] px-3 py-2 text-sm leading-snug text-[#53616a]">
                  Uses the shared fret positions and fretboard radius. These marker settings are
                  only required for marker exports or when including markers with fret slots.
                </div>
                <label
                  className="flex items-center gap-2 text-sm font-semibold text-[#26302f]"
                  {...fieldHoverProps("markersEnabled")}
                >
                  <input
                    className="h-4 w-4 accent-[#19695f]"
                    type="checkbox"
                    checked={form.markersEnabled}
                    onChange={(event) =>
                      updateBooleanField("markersEnabled", event.target.checked)
                    }
                  />
                  <FieldLabel
                    label="Include marker pockets"
                    description={fieldDescriptions.markersEnabled}
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <label
                    className="grid gap-1 text-sm font-medium text-[#26302f]"
                    {...fieldHoverProps("markerShape")}
                  >
                    <FieldLabel
                      label="Marker shape"
                      description={fieldDescriptions.markerShape}
                    />
                    <select
                      className="h-10 rounded-md border border-[#c7d1d8] bg-white px-3 text-base text-[#1f2523] outline-none transition focus:border-[#19695f] focus:ring-2 focus:ring-[#19695f]/20"
                      value={form.markerShape}
                      onChange={(event) =>
                        updateField("markerShape", event.target.value)
                      }
                    >
                      <option value="dot">Dot</option>
                      <option value="rectangle">Rectangle</option>
                      <option value="diamond">Diamond</option>
                      <option value="trapezoid">Trapezoid</option>
                    </select>
                  </label>

                  <label
                    className="grid gap-1 text-sm font-medium text-[#26302f] sm:col-span-2 lg:col-span-1 xl:col-span-2"
                    {...fieldHoverProps("markerFrets")}
                  >
                    <FieldLabel
                      label="Marker map"
                      description={fieldDescriptions.markerFrets}
                    />
                    <input
                      className="h-10 rounded-md border border-[#c7d1d8] bg-white px-3 text-base text-[#1f2523] outline-none transition focus:border-[#19695f] focus:ring-2 focus:ring-[#19695f]/20"
                      type="text"
                      value={form.markerFrets}
                      onChange={(event) =>
                        updateField("markerFrets", event.target.value)
                      }
                    />
                  </label>

                  <div
                    className="grid gap-2 sm:col-span-2 lg:col-span-1 xl:col-span-2"
                    {...fieldHoverProps("fretSpaceMarkers")}
                  >
                    <div className="text-sm font-semibold text-[#26302f]">
                      <FieldLabel
                        label="Fret space markers"
                        description={fieldDescriptions.fretSpaceMarkers}
                      />
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(92px,1fr))] gap-2">
                      {Array.from({ length: Math.max(form.fretCount, 0) }, (_, index) => {
                        const fretSpace = index + 1;
                        const selectedCount = markerCountByFret.get(fretSpace) ?? 0;

                        return (
                          <div
                            key={fretSpace}
                            className="grid gap-1 rounded-md border border-[#d6dde2] bg-[#f7fafb] p-2"
                          >
                            <div className="text-xs font-semibold uppercase text-[#53616a]">
                              Fret {fretSpace}
                            </div>
                            <div className="grid grid-cols-3 rounded-[4px] border border-[#c7d1d8] bg-[#e8eef2] p-0.5">
                              {([0, 1, 2] as const).map((count) => (
                                <button
                                  key={count}
                                  type="button"
                                  aria-pressed={selectedCount === count}
                                  className={`h-8 rounded-[3px] text-xs font-semibold transition ${
                                    selectedCount === count
                                      ? "bg-[#19695f] text-white shadow-sm"
                                      : "text-[#26302f] hover:bg-white/80"
                                  }`}
                                  onClick={() => updateMarkerCount(fretSpace, count)}
                                >
                                  {count === 0 ? "Off" : count}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {[
                    ["markerWidth", "Marker width"],
                    ["markerLength", "Marker length"],
                    ["markerTopWidth", "Trapezoid top width"],
                    ["markerDepth", "Marker depth"],
                    ["markerDepthPerPass", "Depth per pass"],
                    ["markerBitDiameter", "Marker bit diameter"],
                    ["markerFeedRate", "Marker feed rate"],
                    ["markerPlungeRate", "Marker plunge rate"],
                    ["markerSpindleRpm", "Marker spindle RPM"],
                    ["markerXOffset", "X offset"],
                    ["doubleMarkerSpacing", "Double dot spacing"],
                  ].map(([key, label]) => (
                    <label
                      key={key}
                      className="grid gap-1 text-sm font-medium text-[#26302f]"
                      {...fieldHoverProps(key)}
                    >
                      <FieldLabel label={label} description={fieldDescriptions[key]} />
                      <input
                        className="h-10 rounded-md border border-[#c7d1d8] bg-white px-3 text-base text-[#1f2523] outline-none transition focus:border-[#19695f] focus:ring-2 focus:ring-[#19695f]/20"
                        type="number"
                        step={key === "markerSpindleRpm" ? "1" : "0.001"}
                        value={form[key as keyof FormState] as string | number}
                        onChange={(event) =>
                          updateField(key as keyof FormState, event.target.value)
                        }
                      />
                    </label>
                  ))}
                </div>
              </CollapsiblePanel>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-5 [&>*]:shrink-0 lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:self-start lg:overflow-y-auto">
            <CollapsiblePanel
              title="Cutout And Slot Preview"
              stepLabel="Preview"
              summary="Visual check for material, board outline, cutter path, frets, and markers."
              accent="slate"
              actions={
                <div className="text-sm font-semibold text-[#53616a]">
                  Origin X0 Y0: lower-left front corner
                </div>
              }
            >
              <svg
                className="h-auto w-full rounded-md border border-[#d6dde2] bg-[#f7fafb]"
                viewBox={`0 0 ${preview.width} ${preview.height}`}
                role="img"
                aria-label="Preview of the centered material and fret slot toolpaths"
              >
                <rect
                  x={svgNumber(preview.originX)}
                  y={svgNumber(preview.originY)}
                  width={svgNumber(preview.drawingWidth)}
                  height={svgNumber(preview.drawingHeight)}
                  fill={highlightTarget === "material" ? "#fdeede" : "#e9eef2"}
                  stroke={
                    highlightTarget === "material" ? highlightColor : "#60717b"
                  }
                  strokeWidth={highlightTarget === "material" ? "4" : "2"}
                />
                <polygon
                  points={fretboardOutline.points
                    .map(
                      (point) =>
                        `${svgNumber(
                          preview.originX + point.x * preview.scaleX,
                        )},${svgNumber(
                          preview.originY +
                            preview.drawingHeight -
                            point.y * preview.scaleY,
                        )}`,
                    )
                    .join(" ")}
                  fill="#dcebe2"
                  stroke={
                    highlightTarget === "outline" ? highlightColor : "#19695f"
                  }
                  strokeWidth={highlightTarget === "outline" ? "4" : "2"}
                />
                <polygon
                  points={fretboardOutline.cutterPath
                    .map(
                      (point) =>
                        `${svgNumber(
                          preview.originX + point.x * preview.scaleX,
                        )},${svgNumber(
                          preview.originY +
                            preview.drawingHeight -
                            point.y * preview.scaleY,
                        )}`,
                    )
                    .join(" ")}
                  fill="none"
                  stroke={
                    highlightTarget === "cutterPath" ? highlightColor : "#1f2523"
                  }
                  strokeDasharray="5 5"
                  strokeWidth={highlightTarget === "cutterPath" ? "3" : "1.5"}
                />
                <line
                  x1={svgNumber(preview.originX + preview.drawingWidth / 2)}
                  y1={svgNumber(preview.originY)}
                  x2={svgNumber(preview.originX + preview.drawingWidth / 2)}
                  y2={svgNumber(preview.originY + preview.drawingHeight)}
                  stroke="#8a4f1f"
                  strokeDasharray="6 6"
                  strokeWidth="1.5"
                />
                <line
                  x1={svgNumber(preview.originX)}
                  y1={
                    svgNumber(
                      preview.originY +
                        preview.drawingHeight -
                        layout.nutY * preview.scaleY,
                    )
                  }
                  x2={svgNumber(preview.originX + preview.drawingWidth)}
                  y2={
                    svgNumber(
                      preview.originY +
                        preview.drawingHeight -
                        layout.nutY * preview.scaleY,
                    )
                  }
                  stroke={
                    highlightTarget === "slots" ? highlightColor : "#19695f"
                  }
                  strokeWidth={highlightTarget === "slots" ? "3" : "2"}
                />
                {layout.slots.map((slot) => (
                  <line
                    key={slot.fret}
                    x1={svgNumber(preview.originX + slot.startX * preview.scaleX)}
                    y1={svgNumber(
                      preview.originY +
                        preview.drawingHeight -
                        slot.y * preview.scaleY,
                    )}
                    x2={svgNumber(preview.originX + slot.endX * preview.scaleX)}
                    y2={svgNumber(
                      preview.originY +
                        preview.drawingHeight -
                        slot.y * preview.scaleY,
                    )}
                    stroke={
                      highlightTarget === "slots" ? highlightColor : "#c2412e"
                    }
                    strokeWidth={highlightTarget === "slots" ? "3.5" : "2"}
                    strokeLinecap="round"
                  />
                ))}
                {markers.map((marker) =>
                  marker.shape === "dot" ? (
                    <circle
                      key={marker.id}
                      cx={svgNumber(preview.originX + marker.centerX * preview.scaleX)}
                      cy={svgNumber(
                        preview.originY +
                          preview.drawingHeight -
                          marker.y * preview.scaleY,
                      )}
                      r={svgNumber(
                        (Number(form.markerWidth) / 2) *
                          Math.min(preview.scaleX, preview.scaleY),
                      )}
                      fill={
                        highlightTarget === "markers" ? "#ffd34d" : "#f4d35e"
                      }
                      stroke={
                        highlightTarget === "markers"
                          ? highlightColor
                          : "#8a4f1f"
                      }
                      strokeWidth={
                        highlightTarget === "markers" ? "3" : "1.5"
                      }
                    />
                  ) : (
                    <polygon
                      key={marker.id}
                      points={markerPreviewPolygon(form, marker)
                        .map(
                          (point) =>
                            `${svgNumber(
                              preview.originX + point.x * preview.scaleX,
                            )},${svgNumber(
                              preview.originY +
                                preview.drawingHeight -
                                point.y * preview.scaleY,
                            )}`,
                        )
                        .join(" ")}
                      fill={
                        highlightTarget === "markers" ? "#ffd34d" : "#f4d35e"
                      }
                      stroke={
                        highlightTarget === "markers"
                          ? highlightColor
                          : "#8a4f1f"
                      }
                      strokeWidth={
                        highlightTarget === "markers" ? "3" : "1.5"
                      }
                    />
                  ),
                )}
                <circle
                  cx={svgNumber(preview.originX)}
                  cy={svgNumber(preview.originY + preview.drawingHeight)}
                  r="5"
                  fill="#19695f"
                />
                <text
                  x={svgNumber(preview.originX + 10)}
                  y={svgNumber(preview.originY + preview.drawingHeight - 10)}
                  fill="#19695f"
                  fontSize="14"
                  fontWeight="700"
                >
                  X0 Y0
                </text>
              </svg>
            </CollapsiblePanel>

            <CollapsiblePanel
              title="Radius Preview"
              stepLabel="Surface"
              summary="Cross-section of the generated fretboard top radius at the widest board width."
              accent="teal"
            >
              <svg
                className="h-auto w-full rounded-md border border-[#d6dde2] bg-[#f7fafb]"
                viewBox={`0 0 ${radiusPreview.width} ${radiusPreview.height}`}
                role="img"
                aria-label="Cross-section preview of the fretboard radius"
              >
                <rect
                  x={svgNumber(radiusPreview.leftX)}
                  y={svgNumber(radiusPreview.topY)}
                  width={svgNumber(radiusPreview.rightX - radiusPreview.leftX)}
                  height={svgNumber(radiusPreview.bottomY - radiusPreview.topY)}
                  fill="#e9eef2"
                  stroke="#60717b"
                  strokeWidth="1.5"
                />
                <polygon
                  points={[
                    ...radiusPreview.points.map(
                      (point) => `${svgNumber(point.x)},${svgNumber(point.y)}`,
                    ),
                    `${svgNumber(radiusPreview.rightX)},${svgNumber(radiusPreview.bottomY)}`,
                    `${svgNumber(radiusPreview.leftX)},${svgNumber(radiusPreview.bottomY)}`,
                  ].join(" ")}
                  fill="#dcebe2"
                  stroke="none"
                />
                <line
                  x1={svgNumber(radiusPreview.leftX)}
                  y1={svgNumber(radiusPreview.topY)}
                  x2={svgNumber(radiusPreview.rightX)}
                  y2={svgNumber(radiusPreview.topY)}
                  stroke="#60717b"
                  strokeDasharray="6 6"
                  strokeWidth="1.5"
                />
                <polyline
                  points={radiusPreview.points
                    .map((point) => `${svgNumber(point.x)},${svgNumber(point.y)}`)
                    .join(" ")}
                  fill="none"
                  stroke={
                    highlightTarget === "radius" ? highlightColor : "#19695f"
                  }
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={highlightTarget === "radius" ? "6" : "4"}
                />
                <line
                  x1={svgNumber(radiusPreview.centerX)}
                  y1={svgNumber(radiusPreview.topY - 16)}
                  x2={svgNumber(radiusPreview.centerX)}
                  y2={svgNumber(radiusPreview.bottomY + 10)}
                  stroke="#8a4f1f"
                  strokeDasharray="5 5"
                  strokeWidth="1.5"
                />
                <line
                  x1={svgNumber(radiusPreview.rightX - 18)}
                  y1={svgNumber(radiusPreview.topY)}
                  x2={svgNumber(radiusPreview.rightX - 18)}
                  y2={svgNumber(radiusPreview.bottomY)}
                  stroke="#c2412e"
                  strokeWidth="2"
                />
                <text
                  x={svgNumber(radiusPreview.centerX + 10)}
                  y={svgNumber(radiusPreview.topY - 8)}
                  fill="#8a4f1f"
                  fontSize="13"
                  fontWeight="700"
                >
                  Z0 centerline
                </text>
                <text
                  x={svgNumber(radiusPreview.rightX - 26)}
                  y={svgNumber((radiusPreview.topY + radiusPreview.bottomY) / 2)}
                  fill="#c2412e"
                  fontSize="13"
                  fontWeight="700"
                  textAnchor="end"
                >
                  edge drop {numberFormatter.format(radiusPreview.edgeDrop)} {form.unit}
                </text>
                <text
                  x={svgNumber(radiusPreview.leftX)}
                  y={svgNumber(radiusPreview.height - 18)}
                  fill="#26302f"
                  fontSize="13"
                  fontWeight="700"
                >
                  widest width {numberFormatter.format(radiusPreview.boardWidth)} {form.unit}
                </text>
                <text
                  x={svgNumber(radiusPreview.rightX)}
                  y={svgNumber(radiusPreview.height - 18)}
                  fill="#53616a"
                  fontSize="13"
                  fontWeight="700"
                  textAnchor="end"
                >
                  vertical scale {numberFormatter.format(radiusPreview.verticalExaggeration)}x
                </text>
              </svg>
            </CollapsiblePanel>

            <CollapsiblePanel
              title="Layout Summary"
              stepLabel="Check"
              summary="Key calculated values before exporting any machine files."
              accent="teal"
            >
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border border-[#d6dde2] bg-[#f7fafb] p-3">
                  <div className="text-sm font-medium text-[#53616a]">
                    Fret Formula
                  </div>
                  <div className="mt-2 font-mono text-sm text-[#1f2523]">
                    y = L * (1 - 2^(-n/12))
                  </div>
                </div>
                <div className="rounded-md border border-[#d6dde2] bg-[#f7fafb] p-3">
                  <div className="text-sm font-medium text-[#53616a]">
                    Widest Fretboard
                  </div>
                  <div className="mt-2 text-2xl font-semibold">
                    {numberFormatter.format(layout.maxFretboardWidth)} {form.unit}
                  </div>
                </div>
                <div className="rounded-md border border-[#d6dde2] bg-[#f7fafb] p-3">
                  <div className="text-sm font-medium text-[#53616a]">
                    Layout Offset
                  </div>
                  <div className="mt-2 text-2xl font-semibold">
                    {numberFormatter.format(layout.nutY)} {form.unit}
                  </div>
                </div>
              </div>
            </CollapsiblePanel>

            <CollapsiblePanel
              title="Calculated Frets And Files"
              stepLabel="Export"
              summary="Review cutter-center fret coordinates and download each operation as its own file."
              accent="blue"
            >
              <div className="mb-4 grid gap-3 rounded-md border border-[#d6dde2] bg-[#f7fafb] p-3">
                <div className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-end">
                  <label
                    className="grid gap-1 text-sm font-semibold text-[#26302f]"
                    htmlFor="gcode-file-extension"
                  >
                    <FieldLabel
                      label="Downloaded file extension"
                      description={fieldDescriptions.fileExtension}
                    />
                    <select
                      id="gcode-file-extension"
                      className="h-11 rounded-md border border-[#c7d1d8] bg-white px-3 text-sm font-semibold text-[#26302f] outline-none transition focus:border-[#19695f] focus:ring-2 focus:ring-[#19695f]/20"
                      value={fileExtension}
                      onChange={(event) =>
                        setFileExtension(event.target.value as GCodeFileExtension)
                      }
                    >
                      {gCodeFileExtensions.map((extension) => (
                        <option key={extension} value={extension}>
                          {extension}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="rounded-md border border-[#d6dde2] bg-white px-3 py-2 text-sm leading-snug text-[#53616a]">
                    Export only the operation you plan to run. Each button downloads a separate
                    G-code file using the shared board setup plus that operation&apos;s own settings.
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <section className="grid gap-3 rounded-md border border-[#d6dde2] bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-[4px] bg-[#e8eef2] px-2 py-0.5 text-xs font-bold uppercase tracking-[0.1em] text-[#39474e]">
                        Surface
                      </span>
                      <span className={`text-xs font-bold ${canGenerateRadius ? "text-[#14544c]" : "text-[#7d2d20]"}`}>
                        {canGenerateRadius ? "Ready" : "Needs input"}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-[#1f2523]">
                        Radius the fretboard top
                      </h3>
                      <p className="mt-1 text-sm leading-snug text-[#53616a]">
                        Cuts the curved top surface to the selected fretboard radius.
                      </p>
                    </div>
                    <div className="font-mono text-xs text-[#53616a]">
                      {gCodeFilename(fileExtension, "fretboard-radius")}
                    </div>
                    <button
                      type="button"
                      className="h-11 rounded-md bg-[#60717b] px-3 text-sm font-semibold text-white transition hover:bg-[#39474e] disabled:cursor-not-allowed disabled:bg-[#9ca49b]"
                      disabled={!canGenerateRadius}
                      onClick={handleGenerateRadius}
                    >
                      Download Radius Top G-code
                    </button>
                  </section>

                  <section className="grid gap-3 rounded-md border border-[#d6dde2] bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-[4px] bg-[#e1ecf4] px-2 py-0.5 text-xs font-bold uppercase tracking-[0.1em] text-[#264c66]">
                        Cutout
                      </span>
                      <span className={`text-xs font-bold ${canGenerateCutout ? "text-[#14544c]" : "text-[#7d2d20]"}`}>
                        {canGenerateCutout ? "Ready" : "Needs input"}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-[#1f2523]">
                        Cut the fretboard outline
                      </h3>
                      <p className="mt-1 text-sm leading-snug text-[#53616a]">
                        Profiles the tapered board shape with optional holding tabs.
                      </p>
                    </div>
                    <div className="font-mono text-xs text-[#53616a]">
                      {gCodeFilename(fileExtension, "fretboard-cutout")}
                    </div>
                    <button
                      type="button"
                      className="h-11 rounded-md bg-[#2f5d7c] px-3 text-sm font-semibold text-white transition hover:bg-[#264c66] disabled:cursor-not-allowed disabled:bg-[#9ca49b]"
                      disabled={!canGenerateCutout}
                      onClick={handleGenerateCutout}
                    >
                      Download Cutout G-code
                    </button>
                  </section>

                  <section className="grid gap-3 rounded-md border border-[#d6dde2] bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-[4px] bg-[#dcebe2] px-2 py-0.5 text-xs font-bold uppercase tracking-[0.1em] text-[#14544c]">
                        Slots
                      </span>
                      <span className={`text-xs font-bold ${canGenerate ? "text-[#14544c]" : "text-[#7d2d20]"}`}>
                        {canGenerate ? "Ready" : "Needs input"}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-[#1f2523]">
                        {form.markersEnabled
                          ? "Cut fret slots and marker pockets"
                          : "Cut fret slots"}
                      </h3>
                      <p className="mt-1 text-sm leading-snug text-[#53616a]">
                        {form.markersEnabled
                          ? "Cuts radiused fret slots, then marker pockets in the same file."
                          : "Cuts fret slots with slot bottoms matching the selected radius."}
                      </p>
                    </div>
                    <div className="font-mono text-xs text-[#53616a]">
                      {gCodeFilename(fileExtension, "fret-slots")}
                    </div>
                    <button
                      type="button"
                      className="h-11 rounded-md bg-[#19695f] px-3 text-sm font-semibold text-white transition hover:bg-[#14544c] disabled:cursor-not-allowed disabled:bg-[#9ca49b]"
                      disabled={!canGenerate}
                      onClick={handleGenerate}
                    >
                      {form.markersEnabled
                        ? "Download Slots + Markers G-code"
                        : "Download Fret Slots G-code"}
                    </button>
                  </section>

                  <section className="grid gap-3 rounded-md border border-[#d6dde2] bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-[4px] bg-[#f4e6d8] px-2 py-0.5 text-xs font-bold uppercase tracking-[0.1em] text-[#724018]">
                        Markers
                      </span>
                      <span className={`text-xs font-bold ${canGenerateMarkers ? "text-[#14544c]" : "text-[#7d2d20]"}`}>
                        {canGenerateMarkers ? "Ready" : "Needs input"}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-[#1f2523]">
                        Cut marker pockets only
                      </h3>
                      <p className="mt-1 text-sm leading-snug text-[#53616a]">
                        Cuts only the selected dot or inlay pockets, with no fret-slot moves.
                      </p>
                    </div>
                    <div className="font-mono text-xs text-[#53616a]">
                      {gCodeFilename(fileExtension, "fretboard-markers")}
                    </div>
                    <button
                      type="button"
                      className="h-11 rounded-md bg-[#8a4f1f] px-3 text-sm font-semibold text-white transition hover:bg-[#724018] disabled:cursor-not-allowed disabled:bg-[#9ca49b]"
                      disabled={!canGenerateMarkers}
                      onClick={handleGenerateMarkers}
                    >
                      Download Marker Pockets G-code
                    </button>
                  </section>
                </div>
              </div>

              <div className="mb-4 grid gap-2 md:grid-cols-2">
                {validationGroups.map(({ label, validation }) => {
                  const isReady = validation.errors.length === 0;

                  return (
                    <div
                      key={label}
                      className={`rounded-md border px-3 py-2 text-sm ${
                        isReady
                          ? "border-[#b8d0c1] bg-[#f1f8f3] text-[#14544c]"
                          : "border-[#d29b91] bg-[#fff1ef] text-[#7d2d20]"
                      }`}
                    >
                      <div className="font-semibold">
                        {label}: {isReady ? "ready" : "needs input"}
                      </div>
                      {validation.errors.length > 0 ? (
                        <ul className="mt-1 list-disc pl-5">
                          {validation.errors.map((error) => (
                            <li key={error}>{error}</li>
                          ))}
                        </ul>
                      ) : null}
                      {validation.warnings.length > 0 ? (
                        <ul className="mt-1 list-disc pl-5 text-[#72560e]">
                          {validation.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="max-h-[420px] overflow-auto rounded-md border border-[#d6dde2]">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 bg-[#e8eef2] text-[#26302f]">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Fret</th>
                      <th className="px-3 py-2 font-semibold">Scale Y</th>
                      <th className="px-3 py-2 font-semibold">Machine Y</th>
                      <th className="px-3 py-2 font-semibold">Board width</th>
                      <th className="px-3 py-2 font-semibold">Slot length</th>
                      <th className="px-3 py-2 font-semibold">X start</th>
                      <th className="px-3 py-2 font-semibold">X end</th>
                    </tr>
                  </thead>
                  <tbody>
                    {layout.slots.map((slot) => (
                      <tr key={slot.fret} className="border-t border-[#e6ded2]">
                        <td className="px-3 py-2 font-medium">{slot.fret}</td>
                        <td className="px-3 py-2">
                          {numberFormatter.format(slot.scalePosition)}
                        </td>
                        <td className="px-3 py-2">
                          {numberFormatter.format(slot.y)}
                        </td>
                        <td className="px-3 py-2">
                          {numberFormatter.format(slot.fretboardWidth)}
                        </td>
                        <td className="px-3 py-2">
                          {numberFormatter.format(slot.slotLength)}
                        </td>
                        <td className="px-3 py-2">
                          {numberFormatter.format(slot.startX)}
                        </td>
                        <td className="px-3 py-2">
                          {numberFormatter.format(slot.endX)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsiblePanel>
          </div>
        </section>
      </div>
    </main>
  );
}
