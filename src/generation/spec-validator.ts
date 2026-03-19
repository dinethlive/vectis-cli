import { z } from "zod";
import type { LayoutSpec, LayoutNode } from "./types.js";

// ── Result types ─────────────────────────────────────────────

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  path: string;
  message: string;
  severity: ValidationSeverity;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

// ── Validation context ───────────────────────────────────────

export interface ValidationContext {
  /** Known token names (from token_sets). e.g. ["color.primary", "spacing.md"]. */
  tokenNames: Set<string>;
  /** Known component names. */
  componentNames: Set<string>;
}

// ── Zod schemas ──────────────────────────────────────────────

const textPropertiesSchema = z.object({
  content: z.string(),
  typography: z.string().optional(),
  color: z.string().optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  fontSize: z.number().optional(),
  fontWeight: z.union([z.number(), z.string()]).optional(),
  fontFamily: z.string().optional(),
  lineHeight: z.number().optional(),
  letterSpacing: z.number().optional(),
  growType: z.enum(["auto-width", "auto-height", "fixed"]).optional(),
});

const gridTemplateSchema = z.object({
  columns: z.string().optional(),
  rows: z.string().optional(),
  areas: z.array(z.string()).optional(),
});

const paddingSchema = z.union([
  z.string(),
  z.object({
    top: z.string().optional(),
    right: z.string().optional(),
    bottom: z.string().optional(),
    left: z.string().optional(),
  }),
]);

const layoutPropertiesSchema = z.object({
  direction: z.enum(["row", "column"]).optional(),
  wrap: z.boolean().optional(),
  gap: z.string().optional(),
  padding: paddingSchema.optional(),
  alignItems: z.enum(["start", "center", "end", "stretch"]).optional(),
  justifyContent: z
    .enum(["start", "center", "end", "space-between", "space-around"])
    .optional(),
  flexGrow: z.number().optional(),
  flexShrink: z.number().optional(),
  horizontalSizing: z.enum(["auto", "fill", "fix"]).optional(),
  verticalSizing: z.enum(["auto", "fill", "fix"]).optional(),
  gridTemplate: gridTemplateSchema.optional(),
});

const dimensionValue = z.union([z.string(), z.number()]);

const shadowPropertiesSchema = z.object({
  type: z.enum(["dropShadow", "innerShadow"]).optional(),
  offsetX: z.number(),
  offsetY: z.number(),
  blur: z.number(),
  spread: z.number(),
  color: z.string(),
  opacity: z.number().optional(),
});

const shadowValue = z.union([
  z.string(),
  shadowPropertiesSchema,
  z.array(shadowPropertiesSchema),
]);

const stylePropertiesSchema = z.object({
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.string().optional(),
  cornerRadius: z.string().optional(),
  shadow: shadowValue.optional(),
  opacity: z.number().min(0).max(1).optional(),
  width: dimensionValue.optional(),
  height: dimensionValue.optional(),
  minWidth: dimensionValue.optional(),
  maxWidth: dimensionValue.optional(),
  minHeight: dimensionValue.optional(),
  maxHeight: dimensionValue.optional(),
});

const nodeTypeEnum = z.enum([
  "frame",
  "text",
  "rect",
  "ellipse",
  "image",
  "component",
]);

const layoutNodeSchema: z.ZodType<LayoutNode> = z.lazy(() =>
  z.object({
    type: nodeTypeEnum,
    name: z.string(),
    layout: layoutPropertiesSchema.optional(),
    style: stylePropertiesSchema.optional(),
    children: z.array(layoutNodeSchema).optional(),
    text: textPropertiesSchema.optional(),
    componentRef: z.string().optional(),
    componentVariant: z.string().optional(),
  }),
);

const layoutSpecSchema = z.object({
  name: z.string(),
  description: z.string(),
  width: z.number(),
  height: z.number(),
  root: layoutNodeSchema,
});

// ── Public API ───────────────────────────────────────────────

/**
 * Validate a LayoutSpec against structural (Zod) and business rules.
 */
export function validateSpec(
  spec: unknown,
  context: ValidationContext,
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // ── Step 1: Structural validation with Zod ──
  const zodResult = layoutSpecSchema.safeParse(spec);

  if (!zodResult.success) {
    for (const issue of zodResult.error.issues) {
      errors.push({
        path: issue.path.join(".") || "(root)",
        message: issue.message,
        severity: "error",
      });
    }
    // Cannot run business rules on structurally invalid data
    return { valid: false, errors, warnings };
  }

  const validSpec = zodResult.data;

  // ── Step 2: Business rule validation ──
  validateNodeRecursive(validSpec.root, "root", context, errors, warnings);

  // Root-level checks
  if (validSpec.width <= 0 || validSpec.width > 10000) {
    warnings.push({
      path: "width",
      message: `Root width ${validSpec.width} seems unreasonable (expected 1–10000)`,
      severity: "warning",
    });
  }
  if (validSpec.height <= 0 || validSpec.height > 20000) {
    warnings.push({
      path: "height",
      message: `Root height ${validSpec.height} seems unreasonable (expected 1–20000)`,
      severity: "warning",
    });
  }

  // Root name should be PascalCase
  if (!isPascalCase(validSpec.name)) {
    warnings.push({
      path: "name",
      message: `Board name "${validSpec.name}" should be PascalCase`,
      severity: "warning",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ── Recursive node validation ────────────────────────────────

function validateNodeRecursive(
  node: LayoutNode,
  currentPath: string,
  context: ValidationContext,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
): void {
  // 1. Token-ref checks for style properties
  if (node.style) {
    checkTokenRef(node.style.fill, `${currentPath}.style.fill`, context, errors);
    checkTokenRef(node.style.stroke, `${currentPath}.style.stroke`, context, errors);
    checkTokenRef(node.style.strokeWidth, `${currentPath}.style.strokeWidth`, context, errors);
    checkTokenRef(node.style.cornerRadius, `${currentPath}.style.cornerRadius`, context, errors);
    if (typeof node.style.shadow === "string") {
      checkTokenRef(node.style.shadow, `${currentPath}.style.shadow`, context, errors);
    }

    // Reasonable dimension checks
    checkDimension(node.style.width, `${currentPath}.style.width`, warnings);
    checkDimension(node.style.height, `${currentPath}.style.height`, warnings);
  }

  // 2. Token-ref checks for text properties
  if (node.text) {
    checkTokenRef(node.text.typography, `${currentPath}.text.typography`, context, errors);
    checkTokenRef(node.text.color, `${currentPath}.text.color`, context, errors);
  }

  // 3. Token-ref checks for layout properties
  if (node.layout) {
    checkTokenRef(node.layout.gap, `${currentPath}.layout.gap`, context, errors);

    if (typeof node.layout.padding === "string") {
      checkTokenRef(node.layout.padding, `${currentPath}.layout.padding`, context, errors);
    } else if (node.layout.padding && typeof node.layout.padding === "object") {
      const pad = node.layout.padding;
      checkTokenRef(pad.top, `${currentPath}.layout.padding.top`, context, errors);
      checkTokenRef(pad.right, `${currentPath}.layout.padding.right`, context, errors);
      checkTokenRef(pad.bottom, `${currentPath}.layout.padding.bottom`, context, errors);
      checkTokenRef(pad.left, `${currentPath}.layout.padding.left`, context, errors);
    }
  }

  // 4. Layout rule: containers with children must use flex or grid
  if (node.children && node.children.length > 0) {
    const hasFlexOrGrid =
      node.layout &&
      (node.layout.direction !== undefined ||
        node.layout.gridTemplate !== undefined);

    if (!hasFlexOrGrid && node.type === "frame") {
      errors.push({
        path: `${currentPath}.layout`,
        message: `Frame "${node.name}" has children but no flex (direction) or grid (gridTemplate) layout — static/absolute positioning is forbidden`,
        severity: "error",
      });
    }
  }

  // 5. No empty children arrays
  if (node.children !== undefined && node.children.length === 0) {
    errors.push({
      path: `${currentPath}.children`,
      message: `"${node.name}" has an empty children array — omit children for leaf nodes`,
      severity: "error",
    });
  }

  // 6. Component ref must exist
  if (node.type === "component") {
    if (!node.componentRef) {
      errors.push({
        path: `${currentPath}.componentRef`,
        message: `Component node "${node.name}" is missing componentRef`,
        severity: "error",
      });
    } else if (
      context.componentNames.size > 0 &&
      !context.componentNames.has(node.componentRef)
    ) {
      errors.push({
        path: `${currentPath}.componentRef`,
        message: `Component "${node.componentRef}" is not in the component index`,
        severity: "error",
      });
    }
  }

  // 7. Naming convention checks
  if (node.type === "component") {
    if (!isPascalCase(node.name)) {
      warnings.push({
        path: `${currentPath}.name`,
        message: `Component instance "${node.name}" should be PascalCase`,
        severity: "warning",
      });
    }
  } else {
    if (!isCamelCase(node.name) && !isPascalCase(node.name)) {
      warnings.push({
        path: `${currentPath}.name`,
        message: `Layer name "${node.name}" should be camelCase`,
        severity: "warning",
      });
    }
  }

  // Recurse into children
  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      validateNodeRecursive(
        node.children[i],
        `${currentPath}.children[${i}]`,
        context,
        errors,
        warnings,
      );
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────

const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;
const RAW_PX_RE = /^\d+(\.\d+)?px$/;

function checkTokenRef(
  value: string | undefined,
  path: string,
  context: ValidationContext,
  issues: ValidationIssue[],
): void {
  if (value === undefined) return;

  // When no tokens are available, allow raw hex colors and px values
  if (context.tokenNames.size === 0) {
    return;
  }

  // Raw hex color
  if (HEX_COLOR_RE.test(value)) {
    issues.push({
      path,
      message: `Raw hex color "${value}" — use a token reference instead`,
      severity: "error",
    });
    return;
  }

  // Raw px value
  if (RAW_PX_RE.test(value)) {
    issues.push({
      path,
      message: `Raw pixel value "${value}" — use a token reference instead`,
      severity: "error",
    });
    return;
  }

  // If we have a token set, check the reference exists
  if (!context.tokenNames.has(value)) {
    issues.push({
      path,
      message: `Token "${value}" not found in token sets`,
      severity: "error",
    });
  }
}

function checkDimension(
  value: string | number | undefined,
  path: string,
  warnings: ValidationIssue[],
): void {
  if (value === undefined) return;
  if (typeof value === "number" && (value < 0 || value > 20000)) {
    warnings.push({
      path,
      message: `Dimension value ${value} seems unreasonable`,
      severity: "warning",
    });
  }
}

function isPascalCase(str: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*$/.test(str);
}

function isCamelCase(str: string): boolean {
  return /^[a-z][a-zA-Z0-9]*$/.test(str);
}
