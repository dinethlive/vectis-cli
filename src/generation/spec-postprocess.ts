import type { LayoutSpec, LayoutNode } from "./types.js";

export interface PostProcessResult {
  spec: LayoutSpec;
  fixes: string[];
}

/**
 * Post-process a generated LayoutSpec to fix common AI output issues:
 * 1. Snap spacing/gap/padding/radius to nearest 4px grid
 * 2. Enforce minimum sizes on interactive elements
 * 3. Fill missing text defaults (fontFamily, growType, fontSize, fontWeight)
 * 4. Warn on low-contrast text/background combinations
 */
export function postProcessSpec(spec: LayoutSpec): PostProcessResult {
  const fixes: string[] = [];
  const root = processNode(spec.root, null, fixes);
  return { spec: { ...spec, root }, fixes };
}

function processNode(
  node: LayoutNode,
  parentFill: string | null,
  fixes: string[],
): LayoutNode {
  let result = { ...node };

  // Rule 1: Snap to 4px grid
  if (result.layout) {
    result.layout = snapLayoutValues({ ...result.layout }, result.name, fixes);
  }
  if (result.style?.cornerRadius) {
    const snapped = snapNumericStr(
      result.style.cornerRadius,
      result.name,
      "cornerRadius",
      fixes,
    );
    if (snapped !== result.style.cornerRadius) {
      result = { ...result, style: { ...result.style, cornerRadius: snapped } };
    }
  }

  // Rule 2: Enforce min sizes on interactive elements
  result = enforceMinSizes(result, fixes);

  // Rule 3: Fill text defaults
  if (result.type === "text" && result.text) {
    result = fillTextDefaults(result, fixes);
  }

  // Rule 4: Warn on low contrast
  if (result.type === "text" && result.text?.color && parentFill) {
    checkContrast(result.text.color, parentFill, result.name, fixes);
  }

  // Recurse children
  if (result.children) {
    const fill = result.style?.fill ?? parentFill;
    result = {
      ...result,
      children: result.children.map((c) => processNode(c, fill, fixes)),
    };
  }

  return result;
}

// ── Rule 1: Snap to 4px grid ──────────────────────────────────

function snapToGrid(value: number, grid: number = 4): number {
  return Math.round(value / grid) * grid;
}

function isNumericStr(s: string): boolean {
  return /^\d+(\.\d+)?$/.test(s.trim());
}

function snapNumericStr(
  value: string,
  nodeName: string,
  prop: string,
  fixes: string[],
): string {
  if (!isNumericStr(value)) return value;
  const n = parseFloat(value);
  const snapped = snapToGrid(n);
  if (snapped !== n) {
    fixes.push(`${nodeName}: snapped ${prop} ${n}\u2192${snapped}px`);
    return String(snapped);
  }
  return value;
}

function snapLayoutValues(
  layout: NonNullable<LayoutNode["layout"]>,
  nodeName: string,
  fixes: string[],
): NonNullable<LayoutNode["layout"]> {
  if (layout.gap) {
    layout.gap = snapNumericStr(layout.gap, nodeName, "gap", fixes);
  }
  if (layout.padding) {
    if (typeof layout.padding === "string") {
      layout.padding = snapNumericStr(
        layout.padding,
        nodeName,
        "padding",
        fixes,
      );
    } else {
      const p = { ...layout.padding };
      if (p.top)
        p.top = snapNumericStr(p.top, nodeName, "padding.top", fixes);
      if (p.right)
        p.right = snapNumericStr(p.right, nodeName, "padding.right", fixes);
      if (p.bottom)
        p.bottom = snapNumericStr(p.bottom, nodeName, "padding.bottom", fixes);
      if (p.left)
        p.left = snapNumericStr(p.left, nodeName, "padding.left", fixes);
      layout.padding = p;
    }
  }
  return layout;
}

// ── Rule 2: Enforce minimum sizes ─────────────────────────────

const INTERACTIVE_RE = /button|btn|input|select|toggle|checkbox|switch/i;
const MIN_INTERACTIVE_HEIGHT = 32;

function enforceMinSizes(node: LayoutNode, fixes: string[]): LayoutNode {
  if (!INTERACTIVE_RE.test(node.name) || !node.style) return node;

  const h =
    typeof node.style.height === "number"
      ? node.style.height
      : typeof node.style.height === "string"
        ? parseFloat(node.style.height)
        : NaN;

  if (!isNaN(h) && h > 0 && h < MIN_INTERACTIVE_HEIGHT) {
    fixes.push(
      `${node.name}: enforced min height ${MIN_INTERACTIVE_HEIGHT}px (was ${h}px)`,
    );
    return {
      ...node,
      style: { ...node.style, height: MIN_INTERACTIVE_HEIGHT },
    };
  }
  return node;
}

// ── Rule 3: Fill text defaults ────────────────────────────────

function fillTextDefaults(node: LayoutNode, fixes: string[]): LayoutNode {
  if (!node.text) return node;
  const text = { ...node.text };
  let changed = false;

  if (!text.fontFamily) {
    text.fontFamily = "Inter";
    fixes.push(`${node.name}: added default fontFamily=Inter`);
    changed = true;
  }
  if (!text.growType) {
    text.growType = "auto-width";
    fixes.push(`${node.name}: added default growType=auto-width`);
    changed = true;
  }
  if (text.fontSize === undefined) {
    text.fontSize = 16;
    fixes.push(`${node.name}: added default fontSize=16`);
    changed = true;
  }
  if (text.fontWeight === undefined) {
    text.fontWeight = 400;
    fixes.push(`${node.name}: added default fontWeight=400`);
    changed = true;
  }

  return changed ? { ...node, text } : node;
}

// ── Rule 4: Contrast check ───────────────────────────────────

function checkContrast(
  textColor: string,
  bgColor: string,
  nodeName: string,
  fixes: string[],
): void {
  const tLum = luminance(textColor);
  const bLum = luminance(bgColor);
  if (tLum === null || bLum === null) return;

  const lighter = Math.max(tLum, bLum);
  const darker = Math.min(tLum, bLum);
  const ratio = (lighter + 0.05) / (darker + 0.05);

  if (ratio < 3) {
    fixes.push(
      `${nodeName}: low contrast ${ratio.toFixed(1)}:1 (${textColor} on ${bgColor})`,
    );
  }
}

function luminance(hex: string): number | null {
  if (!hex.startsWith("#")) return null;
  const h = hex.slice(1);
  if (h.length !== 6 && h.length !== 3) return null;

  const parse = (s: string) =>
    parseInt(s.length === 1 ? s + s : s, 16) / 255;
  const r = parse(h.length === 3 ? h[0] : h.slice(0, 2));
  const g = parse(h.length === 3 ? h[1] : h.slice(2, 4));
  const b = parse(h.length === 3 ? h[2] : h.slice(4, 6));

  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
