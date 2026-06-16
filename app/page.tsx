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
    return (
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6e6354]">
        {label}
      </span>
    );
  }

  return (
    <span className="inline-flex w-fit items-center text-[11px] font-bold uppercase tracking-[0.08em] text-[#6e6354]">
      <span
        className="cursor-help underline decoration-[#8d7f63] decoration-dotted underline-offset-4"
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
          className={`pointer-events-none fixed z-50 w-[264px] rounded-none border border-[#43361f] bg-[#2b2620] px-3 py-2 text-xs font-normal normal-case leading-snug tracking-normal text-white shadow-lg ${
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

/* A rotated ink stamp, e.g. SHARED / OP 1 / READY */
function Stamp({
  label,
  tone = "red",
  tilt = -1,
}: {
  label: string;
  tone?: "red" | "green";
  tilt?: number;
}) {
  const color = tone === "green" ? "#1f6e54" : "#9b3b2a";
  return (
    <span
      className="inline-block whitespace-nowrap border-[1.5px] border-current px-1.5 py-[2px] text-[10px] font-bold uppercase tracking-[0.12em]"
      style={{ color, transform: `rotate(${tilt}deg)` }}
    >
      {label}
    </span>
  );
}

/* Sub-group divider label inside a panel (e.g. SCALE & FRETS) */
function SubLabel({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-dotted border-[#b4a585] pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#6e6354]">
      {children}
    </div>
  );
}

/* Worksheet panel: "N · TITLE" header in Oswald with an op stamp, collapsible. */
function Panel({
  number,
  title,
  stamp,
  stampTone = "red",
  note,
  defaultOpen = true,
  actions,
  children,
}: {
  number?: string;
  title: string;
  stamp?: string;
  stampTone?: "red" | "green";
  note?: string;
  defaultOpen?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="rounded-none border-2 border-[#2b2620] bg-[#faf4e4]">
      <div className="flex items-center gap-2.5 border-b-2 border-[#2b2620] px-3 py-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-baseline gap-2.5 text-left"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
        >
          <span className="shrink-0 font-[family-name:var(--font-display)] text-base font-semibold uppercase tracking-[0.08em] text-[#2b2620]">
            {number ? `${number} · ${title}` : title}
          </span>
          {note ? (
            <span className="hidden truncate text-xs normal-case text-[#6e6354] sm:inline">
              {note}
            </span>
          ) : null}
        </button>
        {actions ? <div className="shrink-0">{actions}</div> : null}
        {stamp ? <Stamp label={stamp} tone={stampTone} /> : null}
        <button
          type="button"
          aria-label={isOpen ? "Collapse" : "Expand"}
          onClick={() => setIsOpen((current) => !current)}
          className="flex h-5 w-5 shrink-0 items-center justify-center border border-[#8d7f63] text-sm font-bold text-[#6e6354]"
        >
          {isOpen ? "–" : "+"}
        </button>
      </div>
      {isOpen ? <div className="p-3">{children}</div> : null}
    </section>
  );
}

/* A single worksheet input: tiny uppercase label over an underline field. */
function WorksheetField({
  fieldKey,
  label,
  value,
  onChange,
  type = "number",
  min,
  step,
  description,
  disabled = false,
  wide = false,
}: {
  fieldKey: keyof FormState;
  label: string;
  value: string | number;
  onChange: (key: keyof FormState, value: string) => void;
  type?: "number" | "text";
  min?: string;
  step?: string;
  description?: string;
  disabled?: boolean;
  wide?: boolean;
}) {
  return (
    <label
      data-h={fieldKey}
      className={`grid gap-0.5 rounded-none p-1 [margin:-4px] ${
        wide ? "col-span-full" : ""
      }`}
    >
      <FieldLabel label={label} description={description} />
      <input
        type={type}
        min={min}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(fieldKey, event.target.value)}
        className="w-full rounded-none border-0 border-b-[1.5px] border-[#8d7f63] bg-transparent px-0 py-0.5 text-[15px] text-[#2b2620] outline-none transition focus:border-[#1f6e54] disabled:opacity-40"
      />
    </label>
  );
}

export default function Home() {
  const [form, setForm] = useState<FormState>(defaultMetricState);
  const [fileExtension, setFileExtension] =
    useState<GCodeFileExtension>(".nc");
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [profileName, setProfileName] = useState("");
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);

  // Hover-to-dimension: hovering any [data-h] field adds .on to every drawing
  // node + dimension callout whose space-separated data-g list contains its key.
  useEffect(() => {
    let current: Element | null = null;
    let lit: Element[] = [];
    const clear = () => {
      lit.forEach((el) => el.classList.remove("on"));
      lit = [];
      current = null;
    };
    const onOver = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const field = target?.closest?.("[data-h]") ?? null;
      if (field === current) {
        return;
      }
      clear();
      if (!field) {
        return;
      }
      current = field;
      const key = field.getAttribute("data-h");
      if (!key) {
        return;
      }
      lit = Array.from(document.querySelectorAll("[data-g]")).filter((el) =>
        (el.getAttribute("data-g") ?? "").split(" ").includes(key),
      );
      lit.forEach((el) => el.classList.add("on"));
    };
    document.addEventListener("mouseover", onOver);
    return () => {
      document.removeEventListener("mouseover", onOver);
      clear();
    };
  }, []);

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

  // DWG 1 — plan view: stock laid horizontally (nut -> heel), board outline,
  // cutter path + tabs, fret slots, markers, origin, and hover dimension
  // callouts. All geometry is recomputed live from the real form values.
  const topGeom = useMemo(() => {
    const u = form.unit;
    const fmt = (v: number) => numberFormatter.format(v);
    const outline = fretboardOutline;
    const matL = Math.max(Number(form.materialLength) || 1, 0.001);
    const matW = Math.max(Number(form.materialWidth) || 1, 0.001);
    const left = 50;
    const right = 950;
    const top = 62;
    const bottom = 188;
    const hs = (right - left) / matL;
    const vs = (bottom - top) / matW;
    const cX = matW / 2;
    const X = (yMM: number) => left + yMM * hs;
    const Y = (xMM: number) => top + (matW - xMM) * vs;

    const nutY = layout.nutY;
    const startY = outline.startY;
    const endY = outline.endY;

    const boardPts = outline.points
      .map((p) => `${svgNumber(X(p.y))},${svgNumber(Y(p.x))}`)
      .join(" ");
    const cutPts = outline.cutterPath
      .map((p) => `${svgNumber(X(p.y))},${svgNumber(Y(p.x))}`)
      .join(" ");

    const nutHalf = outline.nutWidth / 2;
    const nut = { x: X(nutY), y1: Y(cX + nutHalf), y2: Y(cX - nutHalf) };

    const nutSpread = Number(form.nutStringSpread);
    const ratioEnd = clamp((endY - nutY) / Number(form.scaleLength), 0, 1);
    const endSpread =
      nutSpread + (Number(form.bridgeStringSpread) - nutSpread) * ratioEnd;
    const strings = [1, -1].map((side) => ({
      x1: X(nutY),
      y1: Y(cX + (side * nutSpread) / 2),
      x2: X(endY),
      y2: Y(cX + (side * endSpread) / 2),
    }));

    const slots = layout.slots.map((s) => {
      const slotHalf = s.fretboardWidth / 2 - Number(form.fretInset);
      const boardHalf = fretboardOutlineWidthAtY(outline, s.y) / 2;
      return {
        n: s.fret,
        x: X(s.y),
        y1: Y(cX + slotHalf),
        y2: Y(cX - slotHalf),
        ly: Y(cX + boardHalf) - 6,
      };
    });

    const markerR = Math.max((Number(form.markerWidth) / 2) * ((hs + vs) / 2), 1);
    const markerEls = markers.map((m) => ({
      id: m.id,
      cx: X(m.y),
      cy: Y(m.centerX),
      r: markerR,
      isDot: m.shape === "dot",
      poly:
        m.shape === "dot"
          ? ""
          : markerPreviewPolygon(form, m)
              .map((p) => `${svgNumber(X(p.y))},${svgNumber(Y(p.x))}`)
              .join(" "),
    }));

    const tabCount = Math.max(0, Math.round(Number(form.tabCount)));
    const tabEls =
      form.cutoutTabsEnabled && tabCount > 0
        ? Array.from({ length: tabCount }, (_, i) => {
            const yMM = startY + ((endY - startY) * (i + 0.5)) / tabCount;
            const half = fretboardOutlineWidthAtY(outline, yMM) / 2;
            const onTop = i % 2 === 0;
            const w = Math.max(Number(form.tabWidth) * hs, 4);
            return {
              x: X(yMM) - w / 2,
              y: (onTop ? Y(cX + half) : Y(cX - half)) - 3,
              w,
              h: 6,
            };
          })
        : [];

    const f12 = layout.slots[Math.min(11, layout.slots.length - 1)];
    const lastFretY = layout.lastFretY;

    return {
      left,
      right,
      top,
      bottom,
      cX,
      X,
      Y,
      boardPts,
      cutPts,
      nut,
      strings,
      slots,
      markerEls,
      tabEls,
      nutX: X(nutY),
      startX: X(startY),
      endX: X(endY),
      lastFretX: X(lastFretY),
      f12X: f12 ? X(f12.y) : X(nutY),
      f12: f12 ?? null,
      nutSpreadTopY: Y(cX + nutSpread / 2),
      nutSpreadBotY: Y(cX - nutSpread / 2),
      endSpreadTopY: Y(cX + endSpread / 2),
      endSpreadBotY: Y(cX + -endSpread / 2),
      txt: {
        matLen: `material length ${fmt(Number(form.materialLength))} ${u}`,
        width: `width ${fmt(Number(form.materialWidth))}`,
        scale: f12
          ? `nut to fret ${f12.fret} = ${fmt(f12.scalePosition)} (half of ${fmt(
              Number(form.scaleLength),
            )} ${u} scale)`
          : `${fmt(Number(form.scaleLength))} ${u} scale`,
        nutMargin: `nut margin ${fmt(Number(form.nutEndMargin))} ${u}`,
        endMargin: `end margin ${fmt(Number(form.lastFretEndMargin))} ${u} after fret ${form.fretCount}`,
        spreadNut: `string spread ${fmt(nutSpread)} at nut`,
        spreadBridge: `widening to ${fmt(Number(form.bridgeStringSpread))} at bridge`,
        overhang: `board edge ${fmt(Number(form.fretboardOverhang))} outside the strings, each side`,
        inset: `slots stop ${fmt(Number(form.fretInset))} ${u} short of each edge`,
        slots: `${form.fretCount} slots, ${fmt(Number(form.bitDiameter))} ${u} cutter, ${fmt(Number(form.slotDepth))} deep`,
        markers: `pockets ${fmt(Number(form.markerWidth))} dia, ${fmt(Number(form.markerDepth))} deep`,
        tabs: `${form.tabCount} holding tabs, ${fmt(Number(form.tabWidth))} wide x ${fmt(Number(form.tabHeight))} tall`,
      },
    };
  }, [form, fretboardOutline, layout, markers]);

  // DWG 2 — section A-A: cross-section of the blank at its widest point with
  // the top radius arc, surfacing waste, and the fret-slot depth.
  const sectionGeom = useMemo(() => {
    const u = form.unit;
    const fmt = (v: number) => numberFormatter.format(v);
    const leftX = 80;
    const rightX = 920;
    const centerX = 500;
    const topY = 40;
    const bottomY = 200;
    const boardWidth = Math.max(
      fretboardOutline.nutWidth,
      fretboardOutline.endWidth,
    );
    const halfBoard = boardWidth / 2;
    const xScale = (rightX - leftX) / Math.max(boardWidth, 0.000001);
    const edgeDrop =
      halfBoard < Number(form.fretboardRadius)
        ? radiusSagitta(form, layout, layout.centerX + halfBoard)
        : 0;
    const crownPx = 23.5;
    const zScale = edgeDrop > 0 ? crownPx / edgeDrop : 0;
    const points = Array.from({ length: 41 }, (_, i) => {
      const xFromCenter = -halfBoard + boardWidth * (i / 40);
      const sag =
        halfBoard < Number(form.fretboardRadius)
          ? radiusSagitta(form, layout, layout.centerX + xFromCenter)
          : 0;
      return {
        x: centerX + xFromCenter * xScale,
        y: topY + sag * zScale,
      };
    });
    const arcPts = points.map((p) => `${svgNumber(p.x)},${svgNumber(p.y)}`).join(" ");
    const stockPts = `${arcPts} ${rightX},${bottomY} ${leftX},${bottomY}`;
    const wastePts = `${leftX},${topY} ${rightX},${topY} ${points
      .slice()
      .reverse()
      .map((p) => `${svgNumber(p.x)},${svgNumber(p.y)}`)
      .join(" ")}`;
    const slotBottom = topY + 1 + Math.min(Number(form.slotDepth) * 20, bottomY - topY - 12);

    return {
      leftX,
      rightX,
      centerX,
      topY,
      bottomY,
      boardWidth,
      edgeDrop,
      crownPx,
      arcPts,
      stockPts,
      wastePts,
      slotBottom,
      txt: {
        edgeDrop: `edges drop ${fmt(edgeDrop)} ${u}`,
        radius: `top follows a ${fmt(Number(form.fretboardRadius))} ${u} radius`,
        thickness: `${fmt(Number(form.materialThickness))} ${u} thick`,
        slot: `slot ${fmt(Number(form.slotDepth))} deep, bottom follows the radius (${fmt(Number(form.depthPerPass))}/pass)`,
        surf: `shaded material removed by the surfacing pass`,
        caption: `Cross-section at the widest point of the board (${fmt(boardWidth)} ${u}). Vertical slightly exaggerated for clarity.`,
      },
    };
  }, [form, fretboardOutline.nutWidth, fretboardOutline.endWidth, layout]);

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
    <main className="min-h-screen bg-[var(--mat)] px-3 py-6 text-[#2b2620] sm:px-6 sm:py-9">
      <div className="mx-auto w-full max-w-[1480px] rounded-[4px] border border-[#b4a585] bg-[#f2ead7] p-4 shadow-[0_3px_14px_rgba(43,38,32,0.25)] sm:p-7">
        {/* ---- Masthead ---- */}
        <header className="flex flex-wrap items-center gap-4 border-y-[3px] border-double border-[#2b2620] px-1 py-3.5">
          <div className="grid flex-1 gap-0.5">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6e6354]">
              Form FB-22 · Rev C · Luthiery Dept.
            </div>
            <div className="font-[family-name:var(--font-display)] text-[28px] font-semibold uppercase leading-none tracking-[0.04em] sm:text-[30px]">
              Fretboard G-Code Builder
            </div>
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9b3b2a]">
              Surface · Slots · Cutout · Markers
            </div>
          </div>
          <div className="grid justify-items-end gap-1.5">
            <div className="flex border-2 border-[#2b2620]">
              {(["mm", "in"] as const).map((unit) => (
                <button
                  key={unit}
                  type="button"
                  className={`px-4 py-1.5 text-[13px] font-bold uppercase tracking-[0.1em] transition ${
                    form.unit === unit
                      ? "bg-[#2b2620] text-[#f2ead7]"
                      : "bg-transparent text-[#2b2620] hover:bg-[#2b2620]/10"
                  }`}
                  onClick={() => updateField("unit", unit)}
                >
                  {unit === "mm" ? "MM" : "INCH"}
                </button>
              ))}
            </div>
            <Stamp label="Checked · 06/12/26" tone="red" tilt={-1.5} />
          </div>
        </header>

        {/* ---- Job card row ---- */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b-[1.5px] border-[#b4a585] px-1 py-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6e6354]">
            Job Card:
          </span>
          <input
            className="w-[260px] max-w-full rounded-none border-0 border-b-[1.5px] border-[#8d7f63] bg-transparent px-1 py-1 text-sm text-[#2b2620] outline-none transition focus:border-[#1f6e54]"
            type="text"
            placeholder="name this setup, e.g. JAZZMASTER 22F"
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
            className="shrink-0 -rotate-1 rounded-none border-2 border-[#1f6e54] bg-transparent px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1f6e54] transition hover:bg-[#1f6e54]/10 disabled:cursor-not-allowed disabled:border-[#b4a585] disabled:text-[#b4a585]"
            disabled={!profileName.trim()}
            onClick={handleSaveProfile}
          >
            {profiles.some((profile) => profile.name === profileName.trim())
              ? "Update ➜ File"
              : "Save ➜ File"}
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
            {profiles.length === 0 ? (
              <span className="whitespace-nowrap text-xs italic text-[#6e6354]">
                no saved profiles yet — name and file your current setup
              </span>
            ) : (
              profiles.map((profile) => (
                <span
                  key={profile.name}
                  className="flex shrink-0 items-stretch overflow-hidden rounded-none border border-[#8d7f63] bg-[#faf4e4]"
                >
                  <button
                    type="button"
                    className="max-w-48 truncate px-2.5 py-1 text-sm font-bold text-[#2b2620] transition hover:bg-[#e7ddc6]"
                    title={`Load "${profile.name}"`}
                    onClick={() => handleLoadProfile(profile)}
                  >
                    {profile.name}
                  </button>
                  <button
                    type="button"
                    className="border-l border-[#b4a585] px-2 text-sm font-bold text-[#6e6354] transition hover:bg-[#f5ddd4] hover:text-[#9b3b2a]"
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
          <span className="ml-auto hidden shrink-0 whitespace-nowrap text-xs font-bold text-[#bf3b1f] lg:inline">
            ☞ hover any field to see it on the drawings
          </span>
        </div>

        {/* ---- Main two-column worksheet ---- */}
        <div className="grid items-start gap-5 pt-5 lg:grid-cols-[354px_1fr]">
          {/* LEFT: input panels */}
          <div className="grid gap-4">
            <Panel number="1" title="Board Setup" stamp="SHARED" stampTone="green">
              <div className="grid gap-3.5">
                {sharedFieldGroups.map((group) => (
                  <div key={group.title} className="grid gap-2.5">
                    <SubLabel>{group.title}</SubLabel>
                    <div
                      className={`grid gap-x-3.5 gap-y-2.5 ${
                        group.title === "Material"
                          ? "grid-cols-3"
                          : "grid-cols-2"
                      }`}
                    >
                      {group.fields.map((field) => (
                        <WorksheetField
                          key={field.key}
                          fieldKey={field.key}
                          label={field.label}
                          description={fieldDescriptions[field.key]}
                          min={field.min}
                          step={field.step}
                          value={form[field.key] as string | number}
                          onChange={updateField}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel number="2" title="Fret Slots" stamp="OP 1">
              <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5">
                {slotFields.map((field) => (
                  <WorksheetField
                    key={field.key}
                    fieldKey={field.key}
                    label={field.label}
                    description={fieldDescriptions[field.key]}
                    min={field.min}
                    step={field.step}
                    value={form[field.key] as string | number}
                    onChange={updateField}
                  />
                ))}
              </div>
            </Panel>

            <Panel number="3" title="Cutout" stamp="OP 2">
              <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5">
                {(
                  [
                    ["cutoutBitDiameter", "Bit dia."],
                    ["cutoutDepth", "Cut depth"],
                    ["cutoutDepthPerPass", "Depth per pass"],
                    ["cutoutFeedRate", "Feed · mm/min"],
                    ["cutoutPlungeRate", "Plunge · mm/min"],
                    ["cutoutSpindleRpm", "Spindle RPM"],
                    ["cutoutAllowance", "Outside allowance"],
                  ] as const
                ).map(([key, label]) => (
                  <WorksheetField
                    key={key}
                    fieldKey={key}
                    label={label}
                    description={fieldDescriptions[key]}
                    min={key === "cutoutAllowance" ? "0" : "0.001"}
                    step={key === "cutoutSpindleRpm" ? "1" : "0.001"}
                    value={form[key] as string | number}
                    onChange={updateField}
                  />
                ))}
                <label
                  data-h="cutoutTabsEnabled"
                  className="col-span-2 flex items-center gap-2 rounded-none p-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#2b2620] [margin:-4px]"
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-[#1f6e54]"
                    checked={form.cutoutTabsEnabled}
                    onChange={(event) =>
                      updateBooleanField("cutoutTabsEnabled", event.target.checked)
                    }
                  />
                  Leave holding tabs
                </label>
                {(
                  [
                    ["tabCount", "Tab count"],
                    ["tabWidth", "Tab width"],
                    ["tabHeight", "Tab height"],
                  ] as const
                ).map(([key, label]) => (
                  <WorksheetField
                    key={key}
                    fieldKey={key}
                    label={label}
                    description={fieldDescriptions[key]}
                    min="0"
                    step={key === "tabCount" ? "1" : "0.001"}
                    disabled={!form.cutoutTabsEnabled}
                    value={form[key] as string | number}
                    onChange={updateField}
                  />
                ))}
              </div>
            </Panel>

            <Panel number="4" title="Surface Radius" stamp="OP 3" defaultOpen={false}>
              <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5">
                {(
                  [
                    ["radiusBitDiameter", "Ball-nose dia."],
                    ["radiusStepOver", "Stepover"],
                    ["radiusDepthPerPass", "Depth per pass"],
                    ["radiusFeedRate", "Feed · mm/min"],
                    ["radiusPlungeRate", "Plunge · mm/min"],
                    ["radiusSpindleRpm", "Spindle RPM"],
                  ] as const
                ).map(([key, label]) => (
                  <WorksheetField
                    key={key}
                    fieldKey={key}
                    label={label}
                    description={fieldDescriptions[key]}
                    min="0.001"
                    step={key === "radiusSpindleRpm" ? "1" : "0.001"}
                    value={form[key] as string | number}
                    onChange={updateField}
                  />
                ))}
              </div>
            </Panel>

            <Panel number="5" title="Markers" stamp="OP 4" defaultOpen={false}>
              <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5">
                <label
                  data-h="markersEnabled"
                  className="col-span-2 flex items-center gap-2 rounded-none p-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#2b2620] [margin:-4px]"
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-[#1f6e54]"
                    checked={form.markersEnabled}
                    onChange={(event) =>
                      updateBooleanField("markersEnabled", event.target.checked)
                    }
                  />
                  Include marker pockets
                </label>
                <label
                  data-h="markerShape"
                  className="grid gap-0.5 rounded-none p-1 [margin:-4px]"
                >
                  <FieldLabel
                    label="Marker shape"
                    description={fieldDescriptions.markerShape}
                  />
                  <select
                    className="h-8 rounded-none border-0 border-b-[1.5px] border-[#8d7f63] bg-transparent text-[15px] text-[#2b2620] outline-none transition focus:border-[#1f6e54]"
                    value={form.markerShape}
                    onChange={(event) => updateField("markerShape", event.target.value)}
                  >
                    <option value="dot">Dot</option>
                    <option value="rectangle">Rectangle</option>
                    <option value="diamond">Diamond</option>
                    <option value="trapezoid">Trapezoid</option>
                  </select>
                </label>
                <WorksheetField
                  fieldKey="markerFrets"
                  label="Marked frets (double at 12)"
                  description={fieldDescriptions.markerFrets}
                  type="text"
                  value={form.markerFrets}
                  onChange={updateField}
                  wide
                />
                <div
                  data-h="fretSpaceMarkers"
                  className="col-span-2 grid gap-1.5 rounded-none p-1 [margin:-4px]"
                >
                  <FieldLabel
                    label="Fret space markers"
                    description={fieldDescriptions.fretSpaceMarkers}
                  />
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(88px,1fr))] gap-1.5">
                    {Array.from(
                      { length: Math.max(form.fretCount, 0) },
                      (_, index) => {
                        const fretSpace = index + 1;
                        const selectedCount = markerCountByFret.get(fretSpace) ?? 0;
                        return (
                          <div
                            key={fretSpace}
                            className="grid gap-1 border border-[#b4a585] bg-[#f2ead7] p-1.5"
                          >
                            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6e6354]">
                              Fret {fretSpace}
                            </div>
                            <div className="grid grid-cols-3 border border-[#8d7f63]">
                              {([0, 1, 2] as const).map((count) => (
                                <button
                                  key={count}
                                  type="button"
                                  aria-pressed={selectedCount === count}
                                  className={`py-1 text-[11px] font-bold transition ${
                                    selectedCount === count
                                      ? "bg-[#2b2620] text-[#f2ead7]"
                                      : "bg-transparent text-[#2b2620] hover:bg-[#2b2620]/10"
                                  }`}
                                  onClick={() => updateMarkerCount(fretSpace, count)}
                                >
                                  {count === 0 ? "·" : count}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
                {(
                  [
                    ["markerWidth", "Dot dia."],
                    ["markerLength", "Marker length"],
                    ["markerTopWidth", "Trapezoid top width"],
                    ["markerDepth", "Pocket depth"],
                    ["markerDepthPerPass", "Depth per pass"],
                    ["markerBitDiameter", "Marker bit dia."],
                    ["markerFeedRate", "Feed · mm/min"],
                    ["markerPlungeRate", "Plunge · mm/min"],
                    ["markerSpindleRpm", "Spindle RPM"],
                    ["markerXOffset", "X offset"],
                    ["doubleMarkerSpacing", "Double dot spacing"],
                  ] as const
                ).map(([key, label]) => (
                  <WorksheetField
                    key={key}
                    fieldKey={key}
                    label={label}
                    description={fieldDescriptions[key]}
                    step={key === "markerSpindleRpm" ? "1" : "0.001"}
                    value={form[key] as string | number}
                    onChange={updateField}
                  />
                ))}
              </div>
            </Panel>
          </div>

          {/* RIGHT: drawings, figures, files, schedule */}
          <div className="grid min-w-0 gap-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-[#b4a585]">
            <Panel
              title="DWG 1 · Plan View"
              note="stock, outline, cutter path, slots & markers — origin at lower-left of stock"
            >
              <div className="grid gap-2.5">
                <svg
                  viewBox="0 0 1000 268"
                  className="block h-auto w-full"
                  role="img"
                  aria-label="Top view of stock, fretboard outline, cutter path, fret slots and markers"
                >
                  <rect
                    className="gl"
                    data-g="materialLength materialWidth materialThickness"
                    x="50"
                    y="62"
                    width="900"
                    height="126"
                    fill="var(--pv-mat)"
                    stroke="var(--pv-matline)"
                    strokeWidth="1.5"
                  />
                  <polygon
                    className="gl"
                    data-g="nutStringSpread bridgeStringSpread fretboardOverhang nutEndMargin lastFretEndMargin"
                    points={topGeom.boardPts}
                    fill="var(--pv-board)"
                    stroke="var(--pv-boardline)"
                    strokeWidth="1.5"
                  />
                  <polygon
                    className="gl"
                    data-g="cutoutBitDiameter cutoutDepth cutoutDepthPerPass cutoutFeedRate cutoutPlungeRate cutoutSpindleRpm cutoutAllowance"
                    points={topGeom.cutPts}
                    fill="none"
                    stroke="var(--pv-cut)"
                    strokeWidth="1.6"
                    strokeDasharray="7 5"
                  />
                  {topGeom.tabEls.map((t, i) => (
                    <rect
                      key={i}
                      className="gl glf"
                      data-g="cutoutTabsEnabled tabCount tabWidth tabHeight"
                      x={svgNumber(t.x)}
                      y={svgNumber(t.y)}
                      width={svgNumber(t.w)}
                      height={svgNumber(t.h)}
                      fill="var(--pv-tab)"
                    />
                  ))}
                  <line
                    x1="58"
                    y1="125"
                    x2="944"
                    y2="125"
                    stroke="var(--pv-cl)"
                    strokeWidth="1"
                    strokeDasharray="8 6"
                  />
                  {topGeom.strings.map((s, i) => (
                    <line
                      key={i}
                      className="gl"
                      data-g="nutStringSpread bridgeStringSpread fretboardOverhang"
                      x1={svgNumber(s.x1)}
                      y1={svgNumber(s.y1)}
                      x2={svgNumber(s.x2)}
                      y2={svgNumber(s.y2)}
                      stroke="var(--pv-string)"
                      strokeWidth="1.2"
                    />
                  ))}
                  <line
                    className="gl"
                    data-g="scaleLength nutEndMargin"
                    x1={svgNumber(topGeom.nut.x)}
                    y1={svgNumber(topGeom.nut.y1)}
                    x2={svgNumber(topGeom.nut.x)}
                    y2={svgNumber(topGeom.nut.y2)}
                    stroke="var(--pv-nut)"
                    strokeWidth="4.5"
                  />
                  {topGeom.slots.map((s) => (
                    <line
                      key={s.n}
                      className="gl"
                      data-g="fretCount scaleLength fretInset bitDiameter slotDepth feedRate depthPerPass spindleRpm"
                      x1={svgNumber(s.x)}
                      y1={svgNumber(s.y1)}
                      x2={svgNumber(s.x)}
                      y2={svgNumber(s.y2)}
                      stroke="var(--pv-fret)"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />
                  ))}
                  {topGeom.slots.map((s) => (
                    <text
                      key={`n${s.n}`}
                      x={svgNumber(s.x)}
                      y={svgNumber(s.ly)}
                      textAnchor="middle"
                      fontSize="9.5"
                      fontFamily="var(--pv-font)"
                      fill="var(--pv-mut)"
                    >
                      {s.n}
                    </text>
                  ))}
                  {topGeom.markerEls.map((m) =>
                    m.isDot ? (
                      <circle
                        key={m.id}
                        className="gl glf"
                        data-g="markersEnabled markerShape markerFrets markerWidth markerLength markerTopWidth markerDepth markerDepthPerPass markerBitDiameter markerFeedRate markerPlungeRate markerSpindleRpm markerXOffset doubleMarkerSpacing"
                        cx={svgNumber(m.cx)}
                        cy={svgNumber(m.cy)}
                        r={svgNumber(m.r)}
                        fill="var(--pv-marker)"
                        stroke="var(--pv-markerline)"
                        strokeWidth="1.4"
                      />
                    ) : (
                      <polygon
                        key={m.id}
                        className="gl glf"
                        data-g="markersEnabled markerShape markerFrets markerWidth markerLength markerTopWidth markerDepth markerDepthPerPass markerBitDiameter markerFeedRate markerPlungeRate markerSpindleRpm markerXOffset doubleMarkerSpacing"
                        points={m.poly}
                        fill="var(--pv-marker)"
                        stroke="var(--pv-markerline)"
                        strokeWidth="1.4"
                      />
                    ),
                  )}
                  <text
                    x={svgNumber(topGeom.nutX)}
                    y="54"
                    textAnchor="middle"
                    fontSize="10.5"
                    letterSpacing="1.5"
                    fontFamily="var(--pv-font)"
                    fill="var(--pv-mut)"
                  >
                    NUT
                  </text>
                  <text
                    x={svgNumber(topGeom.endX)}
                    y="54"
                    textAnchor="end"
                    fontSize="10.5"
                    letterSpacing="1.5"
                    fontFamily="var(--pv-font)"
                    fill="var(--pv-mut)"
                  >
                    HEEL
                  </text>
                  <g>
                    <circle cx="50" cy="188" r="5" fill="var(--pv-origin)" />
                    <line x1="36" y1="188" x2="64" y2="188" stroke="var(--pv-origin)" strokeWidth="1.2" />
                    <line x1="50" y1="174" x2="50" y2="202" stroke="var(--pv-origin)" strokeWidth="1.2" />
                    <text x="60" y="206" fontSize="12" fontWeight="700" fontFamily="var(--pv-font)" fill="var(--pv-origin)">
                      X0 Y0
                    </text>
                  </g>
                  <g className="co" data-g="materialLength" stroke="var(--pv-hl)">
                    <line x1="50" y1="216" x2="950" y2="216" strokeWidth="1.3" />
                    <line x1="50" y1="210" x2="50" y2="222" strokeWidth="1.3" />
                    <line x1="950" y1="210" x2="950" y2="222" strokeWidth="1.3" />
                    <text x="500" y="234" textAnchor="middle" fontSize="13" fontWeight="700" fontFamily="var(--pv-font)" fill="var(--pv-hl)" stroke="var(--pv-halo)" strokeWidth="3.5" paintOrder="stroke">
                      {topGeom.txt.matLen}
                    </text>
                  </g>
                  <g className="co" data-g="materialWidth" stroke="var(--pv-hl)">
                    <line x1="968" y1="62" x2="968" y2="188" strokeWidth="1.3" />
                    <line x1="962" y1="62" x2="974" y2="62" strokeWidth="1.3" />
                    <line x1="962" y1="188" x2="974" y2="188" strokeWidth="1.3" />
                    <text x="984" y="129" textAnchor="middle" fontSize="13" fontWeight="700" fontFamily="var(--pv-font)" fill="var(--pv-hl)" transform="rotate(-90 984 129)" stroke="var(--pv-halo)" strokeWidth="3.5" paintOrder="stroke">
                      {topGeom.txt.width}
                    </text>
                  </g>
                  <g className="co" data-g="scaleLength fretCount" stroke="var(--pv-hl)">
                    <line x1={svgNumber(topGeom.nutX)} y1="248" x2={svgNumber(topGeom.f12X)} y2="248" strokeWidth="1.3" />
                    <line x1={svgNumber(topGeom.nutX)} y1="242" x2={svgNumber(topGeom.nutX)} y2="254" strokeWidth="1.3" />
                    <line x1={svgNumber(topGeom.f12X)} y1="242" x2={svgNumber(topGeom.f12X)} y2="254" strokeWidth="1.3" />
                    <text x={svgNumber((topGeom.nutX + topGeom.f12X) / 2)} y="262" textAnchor="middle" fontSize="13" fontWeight="700" fontFamily="var(--pv-font)" fill="var(--pv-hl)" stroke="var(--pv-halo)" strokeWidth="3.5" paintOrder="stroke">
                      {topGeom.txt.scale}
                    </text>
                  </g>
                  <g className="co" data-g="nutEndMargin" stroke="var(--pv-hl)">
                    <line x1={svgNumber(topGeom.startX)} y1="84" x2={svgNumber(topGeom.startX)} y2="48" strokeWidth="1.1" />
                    <line x1={svgNumber(topGeom.nutX)} y1="84" x2={svgNumber(topGeom.nutX)} y2="48" strokeWidth="1.1" />
                    <line x1={svgNumber(topGeom.startX)} y1="50" x2={svgNumber(topGeom.nutX)} y2="50" strokeWidth="1.3" />
                    <text x={svgNumber(topGeom.nutX + 8)} y="42" fontSize="13" fontWeight="700" fontFamily="var(--pv-font)" fill="var(--pv-hl)" stroke="var(--pv-halo)" strokeWidth="3.5" paintOrder="stroke">
                      {topGeom.txt.nutMargin}
                    </text>
                  </g>
                  <g className="co" data-g="lastFretEndMargin" stroke="var(--pv-hl)">
                    <line x1={svgNumber(topGeom.lastFretX)} y1="72" x2={svgNumber(topGeom.lastFretX)} y2="48" strokeWidth="1.1" />
                    <line x1={svgNumber(topGeom.endX)} y1="72" x2={svgNumber(topGeom.endX)} y2="48" strokeWidth="1.1" />
                    <line x1={svgNumber(topGeom.lastFretX)} y1="50" x2={svgNumber(topGeom.endX)} y2="50" strokeWidth="1.3" />
                    <text x={svgNumber(topGeom.endX)} y="42" textAnchor="end" fontSize="13" fontWeight="700" fontFamily="var(--pv-font)" fill="var(--pv-hl)" stroke="var(--pv-halo)" strokeWidth="3.5" paintOrder="stroke">
                      {topGeom.txt.endMargin}
                    </text>
                  </g>
                  <g className="co" data-g="nutStringSpread" stroke="var(--pv-hl)">
                    <line x1={svgNumber(topGeom.nutX + 15)} y1={svgNumber(topGeom.nutSpreadTopY)} x2={svgNumber(topGeom.nutX + 15)} y2={svgNumber(topGeom.nutSpreadBotY)} strokeWidth="1.3" />
                    <line x1={svgNumber(topGeom.nutX + 9)} y1={svgNumber(topGeom.nutSpreadTopY)} x2={svgNumber(topGeom.nutX + 21)} y2={svgNumber(topGeom.nutSpreadTopY)} strokeWidth="1.3" />
                    <line x1={svgNumber(topGeom.nutX + 9)} y1={svgNumber(topGeom.nutSpreadBotY)} x2={svgNumber(topGeom.nutX + 21)} y2={svgNumber(topGeom.nutSpreadBotY)} strokeWidth="1.3" />
                    <text x={svgNumber(topGeom.nutX + 26)} y="129" fontSize="13" fontWeight="700" fontFamily="var(--pv-font)" fill="var(--pv-hl)" stroke="var(--pv-halo)" strokeWidth="3.5" paintOrder="stroke">
                      {topGeom.txt.spreadNut}
                    </text>
                  </g>
                  <g className="co" data-g="bridgeStringSpread" stroke="var(--pv-hl)">
                    <line x1="908" y1={svgNumber(topGeom.endSpreadTopY)} x2="908" y2={svgNumber(topGeom.endSpreadBotY)} strokeWidth="1.3" />
                    <text x="900" y="76" textAnchor="end" fontSize="13" fontWeight="700" fontFamily="var(--pv-font)" fill="var(--pv-hl)" stroke="var(--pv-halo)" strokeWidth="3.5" paintOrder="stroke">
                      {topGeom.txt.spreadBridge}
                    </text>
                  </g>
                  <g className="co" data-g="fretboardOverhang" stroke="var(--pv-hl)">
                    <text x="120" y="58" fontSize="13" fontWeight="700" fontFamily="var(--pv-font)" fill="var(--pv-hl)" stroke="var(--pv-halo)" strokeWidth="3.5" paintOrder="stroke">
                      {topGeom.txt.overhang}
                    </text>
                  </g>
                  <g className="co" data-g="fretInset" stroke="var(--pv-hl)">
                    <text x="300" y="60" textAnchor="middle" fontSize="13" fontWeight="700" fontFamily="var(--pv-font)" fill="var(--pv-hl)" stroke="var(--pv-halo)" strokeWidth="3.5" paintOrder="stroke">
                      {topGeom.txt.inset}
                    </text>
                  </g>
                  <g className="co" data-g="bitDiameter slotDepth feedRate depthPerPass spindleRpm fretInset" stroke="var(--pv-hl)">
                    <text x="180" y="214" textAnchor="middle" fontSize="13" fontWeight="700" fontFamily="var(--pv-font)" fill="var(--pv-hl)" stroke="var(--pv-halo)" strokeWidth="3.5" paintOrder="stroke">
                      {topGeom.txt.slots}
                    </text>
                  </g>
                  <g className="co" data-g="markersEnabled markerWidth markerDepth markerFeedRate markerSpindleRpm markerFrets markerShape markerBitDiameter markerLength markerTopWidth markerDepthPerPass markerPlungeRate markerXOffset doubleMarkerSpacing" stroke="var(--pv-hl)">
                    <text x="640" y="214" textAnchor="middle" fontSize="13" fontWeight="700" fontFamily="var(--pv-font)" fill="var(--pv-hl)" stroke="var(--pv-halo)" strokeWidth="3.5" paintOrder="stroke">
                      {topGeom.txt.markers}
                    </text>
                  </g>
                  <g className="co" data-g="cutoutTabsEnabled tabCount tabWidth tabHeight" stroke="var(--pv-hl)">
                    <text x="490" y="42" textAnchor="middle" fontSize="13" fontWeight="700" fontFamily="var(--pv-font)" fill="var(--pv-hl)" stroke="var(--pv-halo)" strokeWidth="3.5" paintOrder="stroke">
                      {topGeom.txt.tabs}
                    </text>
                  </g>
                </svg>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[#6e6354]">
                  <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-3.5 border-[1.5px] border-[var(--pv-matline)] bg-[var(--pv-mat)]" />stock blank</span>
                  <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-3.5 border-[1.5px] border-[var(--pv-boardline)] bg-[var(--pv-board)]" />fretboard</span>
                  <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0 w-4 border-t-2 border-dashed border-[var(--pv-cut)]" />cutter path + tabs</span>
                  <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0 w-4 border-t-[2.5px] border-[var(--pv-fret)]" />fret slot</span>
                  <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full border-[1.5px] border-[var(--pv-markerline)] bg-[var(--pv-marker)]" />marker pocket</span>
                  <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--pv-origin)]" />machine origin X0 Y0</span>
                </div>
              </div>
            </Panel>

            <Panel
              title="DWG 2 · Section A–A"
              note="top radius across the widest point of the board"
            >
              <div className="grid gap-2">
                <svg
                  viewBox="0 0 1000 226"
                  className="block h-auto w-full"
                  role="img"
                  aria-label="Cross-section of the fretboard blank at its widest point, showing the top radius"
                >
                  <polygon className="gl" data-g="materialThickness" points={sectionGeom.stockPts} fill="var(--pv-board)" stroke="var(--pv-boardline)" strokeWidth="1.5" />
                  <polygon className="gl" data-g="radiusBitDiameter radiusStepOver radiusDepthPerPass radiusFeedRate radiusSpindleRpm radiusPlungeRate" points={sectionGeom.wastePts} fill="var(--pv-waste)" stroke="none" />
                  <line x1="80" y1="40" x2="920" y2="40" stroke="var(--pv-cl)" strokeWidth="1.2" strokeDasharray="7 5" />
                  <text x="84" y="30" fontSize="11" fontFamily="var(--pv-font)" fill="var(--pv-mut)">stock top before surfacing</text>
                  <polyline className="gl" data-g="fretboardRadius radiusBitDiameter radiusStepOver radiusDepthPerPass radiusFeedRate radiusSpindleRpm" points={sectionGeom.arcPts} fill="none" stroke="var(--pv-arc)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="500" y1="18" x2="500" y2="212" stroke="var(--pv-cl)" strokeWidth="1" strokeDasharray="5 5" />
                  <text x="508" y="22" fontSize="11" fontFamily="var(--pv-font)" fill="var(--pv-mut)">Z0 at crown centerline</text>
                  <line className="gl" data-g="slotDepth depthPerPass bitDiameter" x1="500" y1="41" x2="500" y2={svgNumber(sectionGeom.slotBottom)} stroke="var(--pv-fret)" strokeWidth="3.5" />
                  <g className="co" data-g="fretboardRadius" stroke="var(--pv-hl)">
                    <line x1="946" y1="40" x2="946" y2="63.5" strokeWidth="1.3" />
                    <line x1="940" y1="40" x2="952" y2="40" strokeWidth="1.3" />
                    <line x1="940" y1="63.5" x2="952" y2="63.5" strokeWidth="1.3" />
                    <text x="938" y="84" textAnchor="end" fontSize="13" fontWeight="700" fontFamily="var(--pv-font)" fill="var(--pv-hl)" stroke="var(--pv-halo)" strokeWidth="3.5" paintOrder="stroke">{sectionGeom.txt.edgeDrop}</text>
                    <line x1="660" y1="92" x2="610" y2="55" strokeWidth="1" />
                    <text x="666" y="100" fontSize="13" fontWeight="700" fontFamily="var(--pv-font)" fill="var(--pv-hl)" stroke="var(--pv-halo)" strokeWidth="3.5" paintOrder="stroke">{sectionGeom.txt.radius}</text>
                  </g>
                  <g className="co" data-g="materialThickness" stroke="var(--pv-hl)">
                    <line x1="52" y1="40" x2="52" y2="200" strokeWidth="1.3" />
                    <line x1="46" y1="40" x2="58" y2="40" strokeWidth="1.3" />
                    <line x1="46" y1="200" x2="58" y2="200" strokeWidth="1.3" />
                    <text x="40" y="123" textAnchor="middle" fontSize="13" fontWeight="700" fontFamily="var(--pv-font)" fill="var(--pv-hl)" transform="rotate(-90 40 123)" stroke="var(--pv-halo)" strokeWidth="3.5" paintOrder="stroke">{sectionGeom.txt.thickness}</text>
                  </g>
                  <g className="co" data-g="slotDepth depthPerPass" stroke="var(--pv-hl)">
                    <line x1="504" y1="56" x2="540" y2="56" strokeWidth="1" />
                    <text x="546" y="60" fontSize="13" fontWeight="700" fontFamily="var(--pv-font)" fill="var(--pv-hl)" stroke="var(--pv-halo)" strokeWidth="3.5" paintOrder="stroke">{sectionGeom.txt.slot}</text>
                  </g>
                  <g className="co" data-g="radiusBitDiameter radiusStepOver radiusDepthPerPass radiusFeedRate radiusSpindleRpm" stroke="var(--pv-hl)">
                    <line x1="250" y1="86" x2="220" y2="52" strokeWidth="1" />
                    <text x="256" y="94" fontSize="13" fontWeight="700" fontFamily="var(--pv-font)" fill="var(--pv-hl)" stroke="var(--pv-halo)" strokeWidth="3.5" paintOrder="stroke">{sectionGeom.txt.surf}</text>
                  </g>
                </svg>
                <div className="text-[11px] text-[#6e6354]">{sectionGeom.txt.caption}</div>
              </div>
            </Panel>

            {/* figures */}
            <div className="grid gap-3.5 sm:grid-cols-3">
              <div className="border-2 border-[#2b2620] bg-[#faf4e4] px-3.5 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6e6354]">
                  Fret Formula
                </div>
                <div className="mt-1.5 text-[15px] font-bold">y = L·(1−2^(−n/12))</div>
              </div>
              <div className="border-2 border-[#2b2620] bg-[#faf4e4] px-3.5 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6e6354]">
                  Widest Fretboard
                </div>
                <div className="mt-1 font-[family-name:var(--font-display)] text-[22px] font-semibold">
                  {numberFormatter.format(layout.maxFretboardWidth)}{" "}
                  <span className="text-[10px] font-bold uppercase">{form.unit}</span>
                </div>
              </div>
              <div className="border-2 border-[#2b2620] bg-[#faf4e4] px-3.5 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6e6354]">
                  Layout Offset
                </div>
                <div className="mt-1 font-[family-name:var(--font-display)] text-[22px] font-semibold">
                  {numberFormatter.format(layout.nutY)}{" "}
                  <span className="text-[10px] font-bold uppercase">{form.unit}</span>
                </div>
              </div>
            </div>

            {/* machine files */}
            <Panel
              title="Machine Files"
              note="export only the operation you plan to run"
              actions={
                <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e6354]">
                  Ext.
                  <select
                    className="rounded-none border-[1.5px] border-[#8d7f63] bg-transparent px-1.5 py-1 text-[13px] font-bold text-[#2b2620] outline-none"
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
              }
            >
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      {
                        op: "OP 3 · Surface",
                        title: "Radius the fretboard top",
                        file: gCodeFilename(fileExtension, "fretboard-radius"),
                        ready: canGenerateRadius,
                        onClick: handleGenerateRadius,
                        cta: "↓ Download Radius G-code",
                      },
                      {
                        op: "OP 2 · Cutout",
                        title: "Cut the board outline + tabs",
                        file: gCodeFilename(fileExtension, "fretboard-cutout"),
                        ready: canGenerateCutout,
                        onClick: handleGenerateCutout,
                        cta: "↓ Download Cutout G-code",
                      },
                      {
                        op: "OP 1 · Slots + Markers",
                        title: form.markersEnabled
                          ? "Slots, then marker pockets"
                          : "Cut the fret slots",
                        file: gCodeFilename(fileExtension, "fret-slots"),
                        ready: canGenerate,
                        onClick: handleGenerate,
                        cta: form.markersEnabled
                          ? "↓ Download Slots + Markers"
                          : "↓ Download Slots G-code",
                      },
                      {
                        op: "OP 4 · Markers Only",
                        title: "Dot pockets, no slot moves",
                        file: gCodeFilename(fileExtension, "fretboard-markers"),
                        ready: canGenerateMarkers,
                        onClick: handleGenerateMarkers,
                        cta: "↓ Download Markers G-code",
                      },
                    ] as const
                  ).map((card) => (
                    <div
                      key={card.op}
                      className="grid gap-1.5 border-[1.5px] border-[#8d7f63] bg-[#f2ead7] px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6e6354]">
                          {card.op}
                        </span>
                        <Stamp
                          label={card.ready ? "Ready" : "Check"}
                          tone={card.ready ? "green" : "red"}
                        />
                      </div>
                      <div className="text-[13px] font-bold text-[#2b2620]">
                        {card.title}
                      </div>
                      <div className="text-xs text-[#6e6354]">{card.file}</div>
                      <button
                        type="button"
                        className="mt-0.5 rounded-none bg-[#2b2620] px-3 py-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[#f2ead7] transition hover:bg-[#43361f] disabled:cursor-not-allowed disabled:bg-[#b4a585]"
                        disabled={!card.ready}
                        onClick={card.onClick}
                      >
                        {card.cta}
                      </button>
                    </div>
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {validationGroups.map(({ label, validation }) => {
                    const isReady = validation.errors.length === 0;
                    return (
                      <div
                        key={label}
                        className={`border-[1.5px] px-3 py-2 text-xs ${
                          isReady
                            ? "border-[#1f6e54] bg-[#e3ecdf] text-[#1f6e54]"
                            : "border-[#9b3b2a] bg-[#f5ddd4] text-[#9b3b2a]"
                        }`}
                      >
                        <div className="font-bold uppercase tracking-[0.06em]">
                          {isReady ? "✓ " : "△ "}
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
                          <ul className="mt-1 list-disc pl-5 text-[#9b3b2a]">
                            {validation.warnings.map((warning) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Panel>

            {/* fret schedule */}
            <Panel title="Fret Schedule" note="cutter-center coordinates · mm">
              <div className="max-h-[340px] overflow-auto border border-[#b4a585]">
                <table className="w-full min-w-[640px] border-collapse text-left text-[12.5px]">
                  <thead className="sticky top-0 bg-[#2b2620] text-[#f2ead7]">
                    <tr>
                      {["Fret", "Scale Y", "Machine Y", "Board W", "Slot Len", "X Start", "X End"].map(
                        (head, i) => (
                          <th
                            key={head}
                            className={`px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em] ${
                              i === 0 ? "text-left" : "text-right"
                            }`}
                          >
                            {head}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {layout.slots.map((slot) => (
                      <tr key={slot.fret} className="border-b border-dotted border-[#b4a585]">
                        <td className="px-3 py-1.5 font-bold">{slot.fret}</td>
                        <td className="px-3 py-1.5 text-right">
                          {numberFormatter.format(slot.scalePosition)}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {numberFormatter.format(slot.y)}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {numberFormatter.format(slot.fretboardWidth)}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {numberFormatter.format(slot.slotLength)}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {numberFormatter.format(slot.startX)}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {numberFormatter.format(slot.endX)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </main>
  );
}
