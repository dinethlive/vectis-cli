import type { LayoutSpec, LayoutNode, ShadowProperties } from "./types.js";
import type { RenderResult } from "./types.js";
import type { PenpotBridge } from "../bridge/penpot.js";
import type { TokenResolver } from "./token-resolver.js";

/**
 * Render a LayoutSpec to Penpot by generating a single JavaScript snippet
 * that runs inside the Penpot plugin via execute_code.
 *
 * Uses the Penpot Plugin API: penpot.createBoard(), penpot.createText(),
 * penpot.createRectangle(), penpot.createEllipse(), shape.appendChild(),
 * board.addFlexLayout(), shape.fills, shape.resize(), etc.
 */
export async function renderToPenpot(
  spec: LayoutSpec,
  bridge: PenpotBridge,
  tokenResolver: TokenResolver | null,
): Promise<RenderResult> {
  const warnings: string[] = [];

  // Resolve tokens first
  let resolvedSpec = spec;
  if (tokenResolver) {
    const resolved = tokenResolver.resolveAll(spec);
    resolvedSpec = resolved.spec;
    warnings.push(...resolved.warnings);
  }

  // Generate JavaScript code to create the entire board tree
  const code = generateBoardCode(resolvedSpec);

  // Execute in Penpot plugin context
  const result = await bridge.runCode(code);

  // Parse result
  const data = result as { rootId?: string; shapeCount?: number; errors?: string[] } | null;

  const shapeIds: string[] = [];
  if (data?.rootId) shapeIds.push(data.rootId);
  if (data?.errors) warnings.push(...data.errors);

  return { shapeIds, warnings };
}

// --------------- Code Generator ---------------

function generateBoardCode(spec: LayoutSpec): string {
  const lines: string[] = [];
  let varCounter = 0;

  lines.push("const errors = [];");
  lines.push("");

  const rootVar = emitNode(spec.root, null, lines, () => `s${varCounter++}`, spec);

  lines.push("");
  lines.push(`return { rootId: ${rootVar} ? ${rootVar}.id : null, shapeCount: ${varCounter}, errors };`);

  return lines.join("\n");
}

function emitNode(
  node: LayoutNode,
  parentVar: string | null,
  lines: string[],
  nextVar: () => string,
  spec: LayoutSpec,
): string {
  const v = nextVar();

  // --- Create shape ---
  switch (node.type) {
    case "frame":
      lines.push(`const ${v} = penpot.createBoard();`);
      break;
    case "text":
      lines.push(`const ${v} = penpot.createText(${JSON.stringify(node.text?.content ?? "Text")});`);
      break;
    case "rect":
      lines.push(`const ${v} = penpot.createRectangle();`);
      break;
    case "ellipse":
      lines.push(`const ${v} = penpot.createEllipse();`);
      break;
    case "image":
    case "component":
      // Fallback to rectangle for unsupported types
      lines.push(`const ${v} = penpot.createRectangle();`);
      break;
    default:
      lines.push(`const ${v} = penpot.createRectangle();`);
      break;
  }

  // --- Set name ---
  lines.push(`${v}.name = ${JSON.stringify(node.name)};`);

  // --- Append to parent ---
  if (parentVar) {
    lines.push(`${parentVar}.appendChild(${v});`);

    // --- Child sizing (must be after appendChild) ---
    try {
      if (node.layout?.horizontalSizing) {
        const sizingMap: Record<string, string> = { auto: "auto", fill: "fill", fix: "fix" };
        const val = sizingMap[node.layout.horizontalSizing];
        if (val) {
          lines.push(`try { ${v}.layoutChild.horizontalSizing = ${JSON.stringify(val)}; } catch(e) {}`);
        }
      }
      if (node.layout?.verticalSizing) {
        const sizingMap: Record<string, string> = { auto: "auto", fill: "fill", fix: "fix" };
        const val = sizingMap[node.layout.verticalSizing];
        if (val) {
          lines.push(`try { ${v}.layoutChild.verticalSizing = ${JSON.stringify(val)}; } catch(e) {}`);
        }
      }
    } catch { /* skip if layoutChild not available */ }
  }

  // --- Set size ---
  const w = num(node.style?.width) ?? (parentVar === null ? spec.width : undefined);
  const h = num(node.style?.height) ?? (parentVar === null ? spec.height : undefined);
  if (w && h) {
    lines.push(`${v}.resize(${w}, ${h});`);
  }

  // --- Fills ---
  if (node.style?.fill) {
    const hex = toHex(node.style.fill);
    lines.push(`try { ${v}.fills = [{ fillColor: ${JSON.stringify(hex)}, fillOpacity: 1 }]; } catch(e) { errors.push("fill on ${esc(node.name)}: " + e.message); }`);
  }

  // --- Stroke ---
  if (node.style?.stroke) {
    const hex = toHex(node.style.stroke);
    const sw = num(node.style?.strokeWidth) ?? 1;
    lines.push(`try { ${v}.strokes = [{ strokeColor: ${JSON.stringify(hex)}, strokeOpacity: 1, strokeWidth: ${sw}, strokeAlignment: "center" }]; } catch(e) { errors.push("stroke on ${esc(node.name)}: " + e.message); }`);
  }

  // --- Corner radius ---
  if (node.style?.cornerRadius) {
    const r = num(node.style.cornerRadius);
    if (r) {
      lines.push(`try { ${v}.borderRadius = ${r}; } catch(e) { errors.push("radius on ${esc(node.name)}: " + e.message); }`);
    }
  }

  // --- Opacity ---
  if (node.style?.opacity !== undefined) {
    lines.push(`${v}.opacity = ${node.style.opacity};`);
  }

  // --- Shadows ---
  if (node.style?.shadow) {
    try {
      const shadows = normalizeShadows(node.style.shadow);
      if (shadows.length > 0) {
        const shadowArr = JSON.stringify(shadows.map(s => ({
          type: s.type === "innerShadow" ? "innerShadow" : "dropShadow",
          offsetX: s.offsetX,
          offsetY: s.offsetY,
          blur: s.blur,
          spread: s.spread,
          color: { color: toHex(s.color), opacity: s.opacity ?? 1 },
        })));
        lines.push(`try { ${v}.shadows = ${shadowArr}; } catch(e) { errors.push("shadow on ${esc(node.name)}: " + e.message); }`);
      }
    } catch { /* skip malformed shadow */ }
  }

  // --- Text styling ---
  if (node.type === "text" && node.text) {
    if (node.text.color) {
      const hex = toHex(node.text.color);
      lines.push(`try { ${v}.fills = [{ fillColor: ${JSON.stringify(hex)}, fillOpacity: 1 }]; } catch(e) {}`);
    }
    if (node.text.fontSize) {
      lines.push(`try { ${v}.fontSize = ${JSON.stringify(String(node.text.fontSize))}; } catch(e) {}`);
    }
    if (node.text.fontWeight) {
      lines.push(`try { ${v}.fontWeight = ${JSON.stringify(String(node.text.fontWeight))}; } catch(e) {}`);
    }
    if (node.text.fontFamily) {
      lines.push(`try { ${v}.fontFamily = ${JSON.stringify(node.text.fontFamily)}; } catch(e) {}`);
    }
    if (node.text.lineHeight) {
      lines.push(`try { ${v}.lineHeight = ${JSON.stringify(String(node.text.lineHeight))}; } catch(e) {}`);
    }
    if (node.text.letterSpacing) {
      lines.push(`try { ${v}.letterSpacing = ${JSON.stringify(String(node.text.letterSpacing))}; } catch(e) {}`);
    }
    if (node.text.align) {
      lines.push(`try { ${v}.align = ${JSON.stringify(node.text.align)}; } catch(e) {}`);
    }
    if (node.text.growType) {
      const growMap: Record<string, number> = { "auto-width": 0, "auto-height": 1, "fixed": 2 };
      lines.push(`try { ${v}.growType = ${growMap[node.text.growType] ?? 0}; } catch(e) {}`);
    }
  }

  // --- Layout (frames only) ---
  if (node.type === "frame" && node.layout) {
    if (node.layout.gridTemplate) {
      emitGridLayout(node, v, lines);
    } else {
      emitFlexLayout(node, v, lines);
    }
  }

  // --- Recurse children ---
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      lines.push("");
      emitNode(child, v, lines, nextVar, spec);
    }
  }

  return v;
}

// --------------- Layout Emitters ---------------

function emitFlexLayout(node: LayoutNode, v: string, lines: string[]): void {
  const lv = `${v}_l`;
  lines.push(`try {`);
  lines.push(`  const ${lv} = ${v}.addFlexLayout();`);

  if (node.layout!.direction) {
    lines.push(`  ${lv}.dir = "${node.layout!.direction}";`);
  }

  if (node.layout!.wrap) {
    lines.push(`  ${lv}.wrap = "wrap";`);
  }

  const gap = num(node.layout!.gap);
  if (gap) {
    lines.push(`  ${lv}.gap = { column: ${gap}, row: ${gap} };`);
  }

  if (node.layout!.padding) {
    if (typeof node.layout!.padding === "string") {
      const p = num(node.layout!.padding) ?? 0;
      lines.push(`  ${lv}.padding = { top: ${p}, right: ${p}, bottom: ${p}, left: ${p} };`);
    } else {
      const pt = num(node.layout!.padding.top) ?? 0;
      const pr = num(node.layout!.padding.right) ?? 0;
      const pb = num(node.layout!.padding.bottom) ?? 0;
      const pl = num(node.layout!.padding.left) ?? 0;
      lines.push(`  ${lv}.padding = { top: ${pt}, right: ${pr}, bottom: ${pb}, left: ${pl} };`);
    }
  }

  if (node.layout!.alignItems) {
    const map: Record<string, number> = { start: 0, center: 1, end: 2, stretch: 3 };
    lines.push(`  ${lv}.alignItems = ${map[node.layout!.alignItems] ?? 0};`);
  }

  if (node.layout!.justifyContent) {
    const map: Record<string, number> = { start: 0, center: 1, end: 2, "space-between": 3, "space-around": 4 };
    lines.push(`  ${lv}.justifyContent = ${map[node.layout!.justifyContent] ?? 0};`);
  }

  lines.push(`} catch(e) { errors.push("layout on ${esc(node.name)}: " + e.message); }`);
}

function emitGridLayout(node: LayoutNode, v: string, lines: string[]): void {
  const lv = `${v}_g`;
  const grid = node.layout!.gridTemplate!;

  lines.push(`try {`);
  lines.push(`  const ${lv} = ${v}.addGridLayout();`);

  if (grid.columns) {
    for (const track of parseGridTracks(grid.columns)) {
      lines.push(`  ${lv}.addColumn(${JSON.stringify(track.type)}, ${track.value});`);
    }
  }

  if (grid.rows) {
    for (const track of parseGridTracks(grid.rows)) {
      lines.push(`  ${lv}.addRow(${JSON.stringify(track.type)}, ${track.value});`);
    }
  }

  if (node.layout!.alignItems) {
    lines.push(`  ${lv}.alignItems = ${JSON.stringify(node.layout!.alignItems)};`);
  }

  if (node.layout!.justifyContent) {
    lines.push(`  ${lv}.justifyContent = ${JSON.stringify(node.layout!.justifyContent)};`);
  }

  const gap = num(node.layout!.gap);
  if (gap) {
    lines.push(`  ${lv}.rowGap = ${gap};`);
    lines.push(`  ${lv}.columnGap = ${gap};`);
  }

  if (node.layout!.padding) {
    if (typeof node.layout!.padding === "string") {
      const p = num(node.layout!.padding) ?? 0;
      lines.push(`  ${lv}.verticalPadding = ${p};`);
      lines.push(`  ${lv}.horizontalPadding = ${p};`);
    } else {
      const pt = num(node.layout!.padding.top) ?? 0;
      const pl = num(node.layout!.padding.left) ?? 0;
      lines.push(`  ${lv}.verticalPadding = ${pt};`);
      lines.push(`  ${lv}.horizontalPadding = ${pl};`);
    }
  }

  lines.push(`} catch(e) { errors.push("grid on ${esc(node.name)}: " + e.message); }`);
}

interface GridTrack {
  type: "flex" | "fixed" | "percent" | "auto";
  value: number;
}

function parseGridTracks(trackStr: string): GridTrack[] {
  return trackStr.trim().split(/\s+/).map((t): GridTrack => {
    if (t === "auto") return { type: "auto", value: 0 };
    if (t.endsWith("fr")) return { type: "flex", value: parseFloat(t) || 1 };
    if (t.endsWith("%")) return { type: "percent", value: parseFloat(t) || 100 };
    if (t.endsWith("px")) return { type: "fixed", value: parseFloat(t) || 0 };
    const n = parseFloat(t);
    return isNaN(n) ? { type: "auto", value: 0 } : { type: "fixed", value: n };
  });
}

// --------------- Helpers ---------------

/** Parse a numeric value from string ("16px", "1.5rem", "24") or number. */
function num(value: string | number | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") return value;
  const n = parseFloat(value.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? undefined : n;
}

/** Ensure a color value starts with # (pass through if already hex). */
function toHex(value: string): string {
  const v = value.trim();
  if (v.startsWith("#")) return v;
  // If it looks like 6/8 hex digits without #, add it
  if (/^[0-9a-fA-F]{6,8}$/.test(v)) return `#${v}`;
  return v;
}

/** Escape a string for use in template literal error messages. */
function esc(s: string): string {
  return s.replace(/"/g, '\\"').replace(/\n/g, " ");
}

/** Normalize shadow value to an array of ShadowProperties. */
function normalizeShadows(shadow: string | ShadowProperties | ShadowProperties[]): ShadowProperties[] {
  if (typeof shadow === "string") return [];  // String shadows handled by token resolver
  if (Array.isArray(shadow)) return shadow;
  return [shadow];
}
