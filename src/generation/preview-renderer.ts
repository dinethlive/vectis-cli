import type { LayoutSpec, LayoutNode } from "./types.js";

const NODE_ICONS: Record<string, string> = {
  frame: "F",
  text: "T",
  rect: "R",
  ellipse: "E",
  image: "I",
  component: "C",
};

function getNodeIcon(type: string): string {
  return NODE_ICONS[type] ?? "?";
}

function formatLayoutInfo(node: LayoutNode): string {
  const parts: string[] = [];

  if (node.layout) {
    if (node.layout.direction) {
      parts.push(node.layout.direction);
    }
    if (node.layout.gap !== undefined) {
      parts.push(`gap:${node.layout.gap}`);
    }
    if (node.layout.alignItems) {
      parts.push(`align:${node.layout.alignItems}`);
    }
    if (node.layout.justifyContent) {
      parts.push(`justify:${node.layout.justifyContent}`);
    }
    if (node.layout.gridTemplate) {
      parts.push("grid");
    }
    if (node.layout.horizontalSizing) {
      parts.push(`h-size:${node.layout.horizontalSizing}`);
    }
    if (node.layout.verticalSizing) {
      parts.push(`v-size:${node.layout.verticalSizing}`);
    }
  }

  return parts.length > 0 ? ` [${parts.join(", ")}]` : "";
}

function formatStyleInfo(node: LayoutNode): string {
  const parts: string[] = [];

  if (node.style) {
    if (node.style.fill) {
      parts.push(`fill:${node.style.fill}`);
    }
    if (node.style.width !== undefined && node.style.height !== undefined) {
      parts.push(`${node.style.width}x${node.style.height}`);
    } else if (node.style.width !== undefined) {
      parts.push(`w:${node.style.width}`);
    } else if (node.style.height !== undefined) {
      parts.push(`h:${node.style.height}`);
    }
    if (node.style.cornerRadius !== undefined) {
      parts.push(`r:${node.style.cornerRadius}`);
    }
    if (node.style.opacity !== undefined && node.style.opacity < 1) {
      parts.push(`opacity:${node.style.opacity}`);
    }
    if (node.style.shadow) {
      parts.push("shadow");
    }
  }

  return parts.length > 0 ? ` {${parts.join(", ")}}` : "";
}

function formatTextInfo(node: LayoutNode): string {
  if (!node.text) return "";
  const content = node.text.content.length > 30
    ? node.text.content.slice(0, 27) + "..."
    : node.text.content;
  const extras: string[] = [];
  if (node.text.fontSize) extras.push(`${node.text.fontSize}px`);
  if (node.text.fontWeight) extras.push(`w${node.text.fontWeight}`);
  if (node.text.growType) extras.push(node.text.growType);
  const suffix = extras.length > 0 ? ` (${extras.join(", ")})` : "";
  return ` "${content}"${suffix}`;
}

function formatComponentRef(node: LayoutNode): string {
  if (!node.componentRef) return "";
  return ` -> ${node.componentRef}`;
}

function renderNode(node: LayoutNode, prefix: string, isLast: boolean): string[] {
  const lines: string[] = [];

  const connector = isLast ? "└── " : "├── ";
  const icon = getNodeIcon(node.type);
  const layoutInfo = formatLayoutInfo(node);
  const styleInfo = formatStyleInfo(node);
  const textInfo = formatTextInfo(node);
  const compRef = formatComponentRef(node);

  const line = `${prefix}${connector}[${icon}] ${node.name}${layoutInfo}${styleInfo}${textInfo}${compRef}`;
  lines.push(line);

  if (node.children && node.children.length > 0) {
    const childPrefix = prefix + (isLast ? "    " : "│   ");
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const childIsLast = i === node.children.length - 1;
      lines.push(...renderNode(child, childPrefix, childIsLast));
    }
  }

  return lines;
}

export function renderPreview(spec: LayoutSpec): string {
  const lines: string[] = [];

  // Header
  lines.push(`┌─ ${spec.name} (${spec.width}x${spec.height})`);
  lines.push(`│  ${spec.description}`);
  lines.push("│");

  // Root node tree
  const rootIcon = getNodeIcon(spec.root.type);
  const rootLayout = formatLayoutInfo(spec.root);
  const rootStyle = formatStyleInfo(spec.root);
  lines.push(`│  [${rootIcon}] ${spec.root.name}${rootLayout}${rootStyle}`);

  if (spec.root.children && spec.root.children.length > 0) {
    for (let i = 0; i < spec.root.children.length; i++) {
      const child = spec.root.children[i];
      const isLast = i === spec.root.children.length - 1;
      const childLines = renderNode(child, "│  ", isLast);
      lines.push(...childLines);
    }
  }

  lines.push("│");
  lines.push("└─────────────────────────────");

  return lines.join("\n");
}
