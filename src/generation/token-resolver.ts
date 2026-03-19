import type { LayoutSpec, LayoutNode } from "./types.js";
import type { PenpotDesignTokens } from "../bridge/types.js";

export class TokenResolver {
  private tokens: PenpotDesignTokens;

  constructor(tokens: PenpotDesignTokens) {
    this.tokens = tokens;
  }

  resolve(tokenRef: string): string | null {
    // Token references look like "color.primary" or "spacing.md"
    // We search across all token sets for a matching path
    const parts = tokenRef.split(".");

    for (const setName of Object.keys(this.tokens)) {
      const tokenSet = this.tokens[setName];
      const value = this.lookupPath(tokenSet, parts);
      if (value !== null) {
        return value;
      }
    }

    return null;
  }

  private lookupPath(obj: Record<string, unknown>, parts: string[]): string | null {
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== "object") {
        return null;
      }
      current = (current as Record<string, unknown>)[part];
    }

    // The token value might be a direct value or nested in a { value: ... } structure
    if (current === null || current === undefined) {
      return null;
    }

    if (typeof current === "string" || typeof current === "number") {
      return String(current);
    }

    if (typeof current === "object" && "value" in (current as Record<string, unknown>)) {
      const val = (current as Record<string, unknown>).value;
      return val !== null && val !== undefined ? String(val) : null;
    }

    return null;
  }

  resolveAll(spec: LayoutSpec): { spec: LayoutSpec; warnings: string[] } {
    const warnings: string[] = [];
    const resolvedRoot = this.resolveNode(spec.root, warnings);

    return {
      spec: {
        ...spec,
        root: resolvedRoot,
      },
      warnings,
    };
  }

  private resolveNode(node: LayoutNode, warnings: string[]): LayoutNode {
    const resolved: LayoutNode = { ...node };

    // Resolve style token references
    if (resolved.style) {
      resolved.style = { ...resolved.style };

      if (resolved.style.fill && this.isTokenRef(resolved.style.fill)) {
        const value = this.resolve(this.stripTokenRef(resolved.style.fill));
        if (value) {
          resolved.style.fill = value;
        } else {
          warnings.push(`Unresolved token: ${resolved.style.fill} on ${node.name}`);
        }
      }

      if (resolved.style.stroke && this.isTokenRef(resolved.style.stroke)) {
        const value = this.resolve(this.stripTokenRef(resolved.style.stroke));
        if (value) {
          resolved.style.stroke = value;
        } else {
          warnings.push(`Unresolved token: ${resolved.style.stroke} on ${node.name}`);
        }
      }

      if (resolved.style.strokeWidth && this.isTokenRef(resolved.style.strokeWidth)) {
        const value = this.resolve(this.stripTokenRef(resolved.style.strokeWidth));
        if (value) {
          resolved.style.strokeWidth = value;
        } else {
          warnings.push(`Unresolved token: ${resolved.style.strokeWidth} on ${node.name}`);
        }
      }

      if (resolved.style.cornerRadius && this.isTokenRef(resolved.style.cornerRadius)) {
        const value = this.resolve(this.stripTokenRef(resolved.style.cornerRadius));
        if (value) {
          resolved.style.cornerRadius = value;
        } else {
          warnings.push(`Unresolved token: ${resolved.style.cornerRadius} on ${node.name}`);
        }
      }

      if (resolved.style.shadow) {
        if (typeof resolved.style.shadow === "string" && this.isTokenRef(resolved.style.shadow)) {
          const value = this.resolve(this.stripTokenRef(resolved.style.shadow));
          if (value) {
            resolved.style.shadow = value;
          } else {
            warnings.push(`Unresolved token: ${resolved.style.shadow} on ${node.name}`);
          }
        } else if (typeof resolved.style.shadow === "object") {
          // Resolve token refs within nested shadow color fields
          const shadows = Array.isArray(resolved.style.shadow) ? resolved.style.shadow : [resolved.style.shadow];
          resolved.style.shadow = shadows.map(s => {
            if (s.color && this.isTokenRef(s.color)) {
              const value = this.resolve(this.stripTokenRef(s.color));
              return { ...s, color: value ?? s.color };
            }
            return s;
          });
        }
      }
    }

    // Resolve layout token references
    if (resolved.layout) {
      resolved.layout = { ...resolved.layout };

      if (resolved.layout.gap && this.isTokenRef(resolved.layout.gap)) {
        const value = this.resolve(this.stripTokenRef(resolved.layout.gap));
        if (value) {
          resolved.layout.gap = value;
        } else {
          warnings.push(`Unresolved token: ${resolved.layout.gap} on ${node.name}`);
        }
      }

      if (typeof resolved.layout.padding === "string" && this.isTokenRef(resolved.layout.padding)) {
        const value = this.resolve(this.stripTokenRef(resolved.layout.padding));
        if (value) {
          resolved.layout.padding = value;
        } else {
          warnings.push(`Unresolved token: ${resolved.layout.padding} on ${node.name}`);
        }
      } else if (resolved.layout.padding && typeof resolved.layout.padding === "object") {
        const pad = { ...resolved.layout.padding };
        for (const side of ["top", "right", "bottom", "left"] as const) {
          const val = pad[side];
          if (val && this.isTokenRef(val)) {
            const resolved_val = this.resolve(this.stripTokenRef(val));
            if (resolved_val) {
              pad[side] = resolved_val;
            } else {
              warnings.push(`Unresolved token: ${val} on ${node.name}.padding.${side}`);
            }
          }
        }
        resolved.layout.padding = pad;
      }
    }

    // Resolve text color token references
    if (resolved.text) {
      resolved.text = { ...resolved.text };

      if (resolved.text.color && this.isTokenRef(resolved.text.color)) {
        const value = this.resolve(this.stripTokenRef(resolved.text.color));
        if (value) {
          resolved.text.color = value;
        } else {
          warnings.push(`Unresolved token: ${resolved.text.color} on ${node.name}`);
        }
      }

      if (resolved.text.typography && this.isTokenRef(resolved.text.typography)) {
        const value = this.resolve(this.stripTokenRef(resolved.text.typography));
        if (value) {
          resolved.text.typography = value;
        } else {
          warnings.push(`Unresolved token: ${resolved.text.typography} on ${node.name}`);
        }
      }
    }

    // Recursively resolve children
    if (resolved.children) {
      resolved.children = resolved.children.map((child) => this.resolveNode(child, warnings));
    }

    return resolved;
  }

  private isTokenRef(value: string): boolean {
    return value.startsWith("{") && value.endsWith("}");
  }

  private stripTokenRef(value: string): string {
    return value.slice(1, -1);
  }
}
