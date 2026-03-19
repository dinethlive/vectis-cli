export interface LayoutSpec {
  name: string;
  description: string;
  width: number;
  height: number;
  root: LayoutNode;
}

export interface LayoutNode {
  type: "frame" | "text" | "rect" | "ellipse" | "image" | "component";
  name: string;
  layout?: LayoutProperties;
  style?: StyleProperties;
  children?: LayoutNode[];
  text?: TextProperties;
  componentRef?: string;
  componentVariant?: string;
}

export interface LayoutProperties {
  direction?: "row" | "column";
  wrap?: boolean;
  gap?: string; // token reference
  padding?: string | { top?: string; right?: string; bottom?: string; left?: string };
  alignItems?: "start" | "center" | "end" | "stretch";
  justifyContent?: "start" | "center" | "end" | "space-between" | "space-around";
  flexGrow?: number;
  flexShrink?: number;
  horizontalSizing?: "auto" | "fill" | "fix";
  verticalSizing?: "auto" | "fill" | "fix";
  gridTemplate?: {
    columns?: string;
    rows?: string;
    areas?: string[];
  };
}

export interface ShadowProperties {
  type?: "dropShadow" | "innerShadow";
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
  opacity?: number;
}

export interface StyleProperties {
  fill?: string; // token reference or hex
  stroke?: string; // token reference or hex
  strokeWidth?: string; // token reference or px
  cornerRadius?: string; // token reference or px
  shadow?: string | ShadowProperties | ShadowProperties[];
  opacity?: number;
  width?: string | number;
  height?: string | number;
  minWidth?: string | number;
  maxWidth?: string | number;
  minHeight?: string | number;
  maxHeight?: string | number;
}

export interface TextProperties {
  content: string;
  typography?: string; // token reference
  color?: string; // token reference or hex
  align?: "left" | "center" | "right";
  fontSize?: number;
  fontWeight?: number | string;
  fontFamily?: string;
  lineHeight?: number;
  letterSpacing?: number;
  growType?: "auto-width" | "auto-height" | "fixed";
}

export interface RenderResult {
  shapeIds: string[];
  warnings: string[];
}
