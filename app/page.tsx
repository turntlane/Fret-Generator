"use client";

import { useMemo, useState } from "react";

type Unit = "mm" | "in";
type MarkerShape = "dot" | "double-dot" | "rectangle" | "diamond" | "trapezoid";

type FormState = {
  unit: Unit;
  scaleLength: number;
  fretCount: number;
  nutStringSpread: number;
  bridgeStringSpread: number;
  fretboardOverhang: number;
  fretInset: number;
  materialWidth: number;
  materialLength: number;
  materialThickness: number;
  bitDiameter: number;
  fretboardRadius: number;
  slotDepth: number;
  feedRate: number;
  depthPerPass: number;
  spindleRpm: number;
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

type MarkerPocket = {
  id: string;
  fretSpace: number;
  centerX: number;
  y: number;
  shape: MarkerShape;
};

const defaultMetricState: FormState = {
  unit: "mm",
  scaleLength: 647.7,
  fretCount: 22,
  nutStringSpread: 35,
  bridgeStringSpread: 52,
  fretboardOverhang: 3,
  fretInset: 1.5,
  materialWidth: 70,
  materialLength: 500,
  materialThickness: 8,
  bitDiameter: 0.6,
  fretboardRadius: 305,
  slotDepth: 1.5,
  feedRate: 300,
  depthPerPass: 0.3,
  spindleRpm: 18000,
  markersEnabled: true,
  markerShape: "dot",
  markerFrets: "3,5,7,9,12,15,17,19,21",
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

const linearInputKeys: Array<keyof FormState> = [
  "scaleLength",
  "nutStringSpread",
  "bridgeStringSpread",
  "fretboardOverhang",
  "fretInset",
  "materialWidth",
  "materialLength",
  "materialThickness",
  "bitDiameter",
  "fretboardRadius",
  "slotDepth",
  "depthPerPass",
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

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 4,
});

function formatNumber(value: number, digits = 4) {
  return Number.isFinite(value) ? value.toFixed(digits) : "0";
}

function svgNumber(value: number) {
  return formatNumber(value, 6);
}

function rounded(value: number, digits = 4) {
  return Number(value.toFixed(digits));
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

function parseMarkerFrets(value: string) {
  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item));
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

  return parseMarkerFrets(input.markerFrets).flatMap((fretSpace): MarkerPocket[] => {
    const y = markerCenterY(fretSpace, layout);
    if (!Number.isFinite(y)) {
      return [];
    }

    const baseX = layout.centerX + Number(input.markerXOffset);

    if (input.markerShape === "double-dot") {
      const spacing = Number(input.doubleMarkerSpacing);
      return [
        {
          id: `${fretSpace}-bass`,
          fretSpace,
          centerX: baseX - spacing / 2,
          y,
          shape: input.markerShape,
        },
        {
          id: `${fretSpace}-treble`,
          fretSpace,
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
        centerX: baseX,
        y,
        shape: input.markerShape,
      },
    ];
  });
}

function markerPolygon(input: FormState, marker: MarkerPocket) {
  const toolRadius = Number(input.markerBitDiameter) / 2;
  const halfWidth = Math.max(Number(input.markerWidth) / 2 - toolRadius, 0);
  const halfLength = Math.max(Number(input.markerLength) / 2 - toolRadius, 0);
  const halfTopWidth = Math.max(Number(input.markerTopWidth) / 2 - toolRadius, 0);

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
  const center = points.reduce(
    (acc, point) => ({ x: acc.x + point.x / points.length, y: acc.y + point.y / points.length }),
    { x: 0, y: 0 },
  );

  return points.map((point) => ({
    x: center.x + (point.x - center.x) * scale,
    y: center.y + (point.y - center.y) * scale,
  }));
}

function getValidationMessages(input: FormState, layout: Layout) {
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
    ["bitDiameter", "Bit diameter"],
    ["fretboardRadius", "Fretboard radius"],
    ["slotDepth", "Slot depth"],
    ["feedRate", "Feed rate"],
    ["depthPerPass", "Depth per pass"],
    ["spindleRpm", "Spindle RPM"],
  ];

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

  if (input.fretInset < 0) {
    errors.push("Fret inset cannot be negative.");
  }

  if (layout.nutY < 0) {
    errors.push("The calculated fret layout is longer than the material.");
  }

  if (layout.maxFretboardWidth > input.materialWidth) {
    errors.push("The calculated fretboard is wider than the material.");
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

  if (input.markersEnabled) {
    const markerFields: Array<[keyof FormState, string]> = [
      ["markerWidth", "Marker width"],
      ["markerDepth", "Marker depth"],
      ["markerDepthPerPass", "Marker depth per pass"],
      ["markerBitDiameter", "Marker bit diameter"],
      ["markerFeedRate", "Marker feed rate"],
      ["markerPlungeRate", "Marker plunge rate"],
      ["markerSpindleRpm", "Marker spindle RPM"],
    ];

    if (input.markerShape !== "dot" && input.markerShape !== "double-dot") {
      markerFields.push(["markerLength", "Marker length"]);
    }

    if (input.markerShape === "trapezoid") {
      markerFields.push(["markerTopWidth", "Trapezoid top width"]);
    }

    if (input.markerShape === "double-dot") {
      markerFields.push(["doubleMarkerSpacing", "Double marker spacing"]);
    }

    for (const [key, label] of markerFields) {
      if (!Number.isFinite(Number(input[key])) || Number(input[key]) <= 0) {
        errors.push(`${label} must be greater than zero.`);
      }
    }

    const markerFrets = parseMarkerFrets(input.markerFrets);
    const rawMarkerFrets = input.markerFrets
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (markerFrets.length === 0) {
      errors.push("Enter at least one marker fret space.");
    }

    if (markerFrets.length !== rawMarkerFrets.length) {
      errors.push("Marker fret spaces must be whole numbers separated by commas.");
    }

    const invalidFrets = markerFrets.filter(
      (fretSpace) => fretSpace < 1 || fretSpace > input.fretCount,
    );
    if (invalidFrets.length > 0) {
      errors.push("Marker fret spaces must be between 1 and the number of frets.");
    }

    if (Number(input.markerWidth) <= Number(input.markerBitDiameter)) {
      errors.push("Marker width must be larger than the marker bit diameter.");
    }

    if (
      input.markerShape !== "dot" &&
      input.markerShape !== "double-dot" &&
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
      input.markerShape === "double-dot"
        ? Number(input.doubleMarkerSpacing) / 2 + Number(input.markerWidth) / 2
        : Number(input.markerWidth) / 2;
    const markerMaxOffset = Math.abs(Number(input.markerXOffset)) + halfMarkerWidth;

    if (markerMaxOffset > layout.maxFretboardWidth / 2) {
      warnings.push("Marker layout extends beyond the calculated fretboard outline.");
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
  const xFromCenter = x - layout.centerX;
  const sagitta =
    input.fretboardRadius -
    Math.sqrt(input.fretboardRadius ** 2 - xFromCenter ** 2);
  return -(passDepth + sagitta);
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

  if (input.markerShape === "dot" || input.markerShape === "double-dot") {
    const maxRadius = Math.max(
      Number(input.markerWidth) / 2 - Number(input.markerBitDiameter) / 2,
      0,
    );
    const contourCount = Math.max(1, Math.ceil(maxRadius / stepOver));
    const pointCount = 40;

    for (let contour = 1; contour <= contourCount; contour += 1) {
      const radius = maxRadius * (contour / contourCount);
      const startX = marker.centerX + radius;
      lines.push(`G0 X${formatNumber(startX)} Y${formatNumber(marker.y)}`);
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
  const maxPocketSpan = Math.max(Number(input.markerWidth), Number(input.markerLength));
  const contourCount = Math.max(1, Math.ceil(maxPocketSpan / 2 / stepOver));

  for (let contour = 1; contour <= contourCount; contour += 1) {
    const points = scaledPolygon(polygon, contour / contourCount);
    const firstPoint = points[0];
    lines.push(`G0 X${formatNumber(firstPoint.x)} Y${formatNumber(firstPoint.y)}`);
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

function generateGCode(input: FormState, layout: Layout) {
  const safeZ = input.unit === "mm" ? 5 : 0.2;
  const plungeFeed = Math.max(input.feedRate * 0.45, input.unit === "mm" ? 25 : 1);
  const pointSpacing = input.unit === "mm" ? 1 : 0.04;
  const passes = Math.ceil(input.slotDepth / input.depthPerPass);
  const markers = calculateMarkers(input, layout);
  const lines: string[] = [
    "%",
    "(Fret slot G-code generated by Fret Slot CNC Builder)",
    `(Units: ${input.unit === "mm" ? "millimeters" : "inches"})`,
    "(Coordinate assumption: X0 Y0 is the lower-left front corner of the material.)",
    "(Z0 is the fretboard top surface at the centerline before slot cutting.)",
    "(Fret position formula: y = scaleLength * (1 - 2^(-fret/12)))",
    "(String spread formula: spread = nutSpread + (bridgeSpread - nutSpread) * (y / scaleLength))",
    "(Slot bottom formula: z = -slotDepth - (radius - sqrt(radius^2 - xOffset^2)))",
    `(Material: ${formatNumber(input.materialWidth)} x ${formatNumber(
      input.materialLength,
    )} x ${formatNumber(input.materialThickness)} ${input.unit})`,
    `(Bit diameter: ${formatNumber(input.bitDiameter)} ${input.unit})`,
    input.unit === "mm" ? "G21" : "G20",
    "G90",
    "G17",
    "G94",
    "G54",
    `G0 Z${formatNumber(safeZ)}`,
    `S${Math.round(input.spindleRpm)} M3`,
  ];

  for (const slot of layout.slots) {
    const sampleCount = Math.max(
      8,
      Math.min(140, Math.ceil((slot.endX - slot.startX) / pointSpacing)),
    );

    lines.push(
      "",
      `(Fret ${slot.fret}: scale position ${formatNumber(
        slot.scalePosition,
      )} ${input.unit}, Y ${formatNumber(slot.y)} ${input.unit})`,
      `(Final slot length ${formatNumber(slot.slotLength)} ${input.unit}; cutter center X ${formatNumber(
        slot.startX,
      )} to ${formatNumber(slot.endX)})`,
    );

    for (let pass = 1; pass <= passes; pass += 1) {
      const passDepth = Math.min(pass * input.depthPerPass, input.slotDepth);
      lines.push(`(Pass ${pass} depth ${formatNumber(passDepth)} ${input.unit})`);
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
    const markerPasses = Math.ceil(
      Number(input.markerDepth) / Number(input.markerDepthPerPass),
    );

    lines.push(
      "",
      "(Fretboard marker pocket operation)",
      `(Marker shape: ${markerShapeLabel(input.markerShape)})`,
      `(Marker positions are centered in the numbered fret spaces.)`,
      `G0 Z${formatNumber(safeZ)}`,
      "M5",
      `S${Math.round(Number(input.markerSpindleRpm))} M3`,
    );

    for (const marker of markers) {
      lines.push(
        "",
        `(Marker fret space ${marker.fretSpace} at X${formatNumber(
          marker.centerX,
        )} Y${formatNumber(marker.y)})`,
      );

      for (let pass = 1; pass <= markerPasses; pass += 1) {
        const passDepth = Math.min(
          pass * Number(input.markerDepthPerPass),
          Number(input.markerDepth),
        );
        lines.push(`(Marker pass ${pass} depth ${formatNumber(passDepth)} ${input.unit})`);
        lines.push(`G0 Z${formatNumber(safeZ)}`);
        addMarkerPocketGCode(lines, input, layout, marker, passDepth);
      }
    }
  }

  lines.push("", `G0 Z${formatNumber(safeZ)}`, "G0 X0 Y0", "M5", "M30", "%");
  return lines.join("\n");
}

async function saveGCode(gcode: string) {
  const blob = new Blob([gcode], { type: "text/plain;charset=utf-8" });
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
      suggestedName: "fret-slots.nc",
      types: [
        {
          description: "G-code file",
          accept: {
            "text/plain": [".nc", ".gcode", ".tap"],
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
  link.download = "fret-slots.nc";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const fieldGroups: Array<{
  title: string;
  fields: Array<{
    key: keyof FormState;
    label: string;
    step?: string;
    min?: string;
  }>;
}> = [
  {
    title: "Scale And Frets",
    fields: [
      { key: "scaleLength", label: "Scale length", step: "0.001", min: "0" },
      { key: "fretCount", label: "Number of frets", step: "1", min: "1" },
    ],
  },
  {
    title: "Fretboard Layout",
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
        label: "Fretboard overhang",
        step: "0.001",
        min: "0",
      },
      { key: "fretInset", label: "Fret inset", step: "0.001", min: "0" },
    ],
  },
  {
    title: "Material",
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
  {
    title: "Toolpath",
    fields: [
      { key: "bitDiameter", label: "Cutting bit diameter", step: "0.001", min: "0" },
      {
        key: "fretboardRadius",
        label: "Fretboard top radius",
        step: "0.001",
        min: "0",
      },
      { key: "slotDepth", label: "Fret slot depth", step: "0.001", min: "0" },
      { key: "feedRate", label: "Feed rate", step: "0.1", min: "0" },
      { key: "depthPerPass", label: "Depth per pass", step: "0.001", min: "0" },
      { key: "spindleRpm", label: "Spindle RPM", step: "1", min: "0" },
    ],
  },
];

export default function Home() {
  const [form, setForm] = useState<FormState>(defaultMetricState);
  const layout = useMemo(() => calculateLayout(form), [form]);
  const markers = useMemo(() => calculateMarkers(form, layout), [form, layout]);
  const validation = useMemo(
    () => getValidationMessages(form, layout),
    [form, layout],
  );
  const canGenerate = validation.errors.length === 0;

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
        key === "fretCount" || key === "spindleRpm"
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

  async function handleGenerate() {
    if (!canGenerate) {
      return;
    }

    await saveGCode(generateGCode(form, layout));
  }

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-[#1f2523]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <section className="grid gap-5 lg:grid-cols-[minmax(330px,420px)_1fr]">
          <div className="flex flex-col gap-4 rounded-lg border border-[#d6dde2] bg-[#ffffff] p-4 shadow-sm">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8a4f1f]">
                CNC fret slot generator
              </p>
              <h1 className="text-3xl font-semibold leading-tight text-[#1f2523]">
                Radiused fret slot G-code
              </h1>
            </div>

            <div className="grid grid-cols-2 rounded-md border border-[#c7d1d8] bg-[#e8eef2] p-1">
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

            <div className="grid gap-4">
              {fieldGroups.map((group) => (
                <fieldset
                  key={group.title}
                  className="grid gap-3 rounded-md border border-[#d6dde2] p-3"
                >
                  <legend className="px-1 text-sm font-semibold text-[#19695f]">
                    {group.title}
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {group.fields.map((field) => (
                      <label
                        key={field.key}
                        className="grid gap-1 text-sm font-medium text-[#26302f]"
                      >
                        <span>{field.label}</span>
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
                </fieldset>
              ))}

              <fieldset className="grid gap-3 rounded-md border border-[#d6dde2] p-3">
                <legend className="px-1 text-sm font-semibold text-[#19695f]">
                  Fretboard Markers
                </legend>
                <label className="flex items-center gap-2 text-sm font-semibold text-[#26302f]">
                  <input
                    className="h-4 w-4 accent-[#19695f]"
                    type="checkbox"
                    checked={form.markersEnabled}
                    onChange={(event) =>
                      updateBooleanField("markersEnabled", event.target.checked)
                    }
                  />
                  Include marker pockets
                </label>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <label className="grid gap-1 text-sm font-medium text-[#26302f]">
                    <span>Marker shape</span>
                    <select
                      className="h-10 rounded-md border border-[#c7d1d8] bg-white px-3 text-base text-[#1f2523] outline-none transition focus:border-[#19695f] focus:ring-2 focus:ring-[#19695f]/20"
                      value={form.markerShape}
                      onChange={(event) =>
                        updateField("markerShape", event.target.value)
                      }
                    >
                      <option value="dot">Dot</option>
                      <option value="double-dot">Double dot</option>
                      <option value="rectangle">Rectangle</option>
                      <option value="diamond">Diamond</option>
                      <option value="trapezoid">Trapezoid</option>
                    </select>
                  </label>

                  <label className="grid gap-1 text-sm font-medium text-[#26302f]">
                    <span>Fret spaces</span>
                    <input
                      className="h-10 rounded-md border border-[#c7d1d8] bg-white px-3 text-base text-[#1f2523] outline-none transition focus:border-[#19695f] focus:ring-2 focus:ring-[#19695f]/20"
                      type="text"
                      value={form.markerFrets}
                      onChange={(event) =>
                        updateField("markerFrets", event.target.value)
                      }
                    />
                  </label>

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
                    >
                      <span>{label}</span>
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
              </fieldset>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <section className="rounded-lg border border-[#d6dde2] bg-[#ffffff] p-4 shadow-sm">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[#1f2523]">
                    Material And Slot Preview
                  </h2>
                  <p className="text-sm text-[#53616a]">
                    X runs across material width. Y runs along material length.
                  </p>
                </div>
                <div className="text-sm font-medium text-[#53616a]">
                  Origin X0 Y0: lower-left front corner
                </div>
              </div>

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
                  fill="#e9eef2"
                  stroke="#60717b"
                  strokeWidth="2"
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
                  stroke="#19695f"
                  strokeWidth="2"
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
                    stroke="#c2412e"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                ))}
                {markers.map((marker) =>
                  marker.shape === "dot" || marker.shape === "double-dot" ? (
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
                      fill="#f4d35e"
                      stroke="#8a4f1f"
                      strokeWidth="1.5"
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
                      fill="#f4d35e"
                      stroke="#8a4f1f"
                      strokeWidth="1.5"
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
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-[#d6dde2] bg-[#ffffff] p-4 shadow-sm">
                <div className="text-sm font-medium text-[#53616a]">
                  Fret Formula
                </div>
                <div className="mt-2 font-mono text-sm text-[#1f2523]">
                  y = L * (1 - 2^(-n/12))
                </div>
              </div>
              <div className="rounded-lg border border-[#d6dde2] bg-[#ffffff] p-4 shadow-sm">
                <div className="text-sm font-medium text-[#53616a]">
                  Widest Fretboard
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {numberFormatter.format(layout.maxFretboardWidth)} {form.unit}
                </div>
              </div>
              <div className="rounded-lg border border-[#d6dde2] bg-[#ffffff] p-4 shadow-sm">
                <div className="text-sm font-medium text-[#53616a]">
                  Layout Offset
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {numberFormatter.format(layout.nutY)} {form.unit}
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-[#d6dde2] bg-[#ffffff] p-4 shadow-sm">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[#1f2523]">
                    Calculated Frets
                  </h2>
                  <p className="text-sm text-[#53616a]">
                    Cutter-center coordinates compensate for bit radius at slot ends.
                  </p>
                </div>
                <button
                  type="button"
                  className="h-11 rounded-md bg-[#19695f] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#14544c] disabled:cursor-not-allowed disabled:bg-[#9ca49b]"
                  disabled={!canGenerate}
                  onClick={handleGenerate}
                >
                  Generate G-Code
                </button>
              </div>

              {(validation.errors.length > 0 || validation.warnings.length > 0) && (
                <div className="mb-4 grid gap-2">
                  {validation.errors.map((error) => (
                    <div
                      key={error}
                      className="rounded-md border border-[#d29b91] bg-[#fff1ef] px-3 py-2 text-sm font-medium text-[#7d2d20]"
                    >
                      {error}
                    </div>
                  ))}
                  {validation.warnings.map((warning) => (
                    <div
                      key={warning}
                      className="rounded-md border border-[#d7bc73] bg-[#fff8df] px-3 py-2 text-sm font-medium text-[#72560e]"
                    >
                      {warning}
                    </div>
                  ))}
                </div>
              )}

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
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
