/**
 * Prompt template for the LayoutSpec generator.
 *
 * Assembles a system prompt that explains the LayoutSpec JSON format,
 * design-token rules, and component constraints, then returns a user
 * prompt that includes the concrete context for this generation request.
 */

export interface SpecPromptContext {
  boardName: string;
  boardDescription?: string;
  flowContext?: string;
  componentNames: string[];
  tokenSets: string[];
  skills: string[];
  useToolUse?: boolean;
}

const DESIGN_PRINCIPLES = `
## Design Principles

1. **Visual Hierarchy** — Use font size, weight, and color contrast to establish clear heading > subheading > body > caption hierarchy. Important actions should be visually prominent.
2. **Consistent Spacing** — Use a spacing scale (4, 8, 12, 16, 24, 32, 48). Padding inside containers should be uniform. Gap between sibling elements should follow the scale.
3. **Cards & Surfaces** — Group related content in cards (frames with fill, cornerRadius, and shadow). Cards create depth and visual separation.
4. **Child Sizing** — Use layout.horizontalSizing: "fill" for elements that should stretch to fill their parent's width. Use "auto" for elements that should fit their content. Use "fix" only for explicit pixel sizes.
5. **Buttons & Inputs** — Buttons should have fill, cornerRadius (6-8px), horizontal padding (16-24px), vertical padding (8-12px). Text inside buttons should be centered. Inputs should have a stroke border, padding, and cornerRadius.
6. **Shadows for Depth** — Use subtle shadows on elevated surfaces (cards, modals, dropdowns). Shadow values: small (0,1,3,0), medium (0,4,6,-1), large (0,10,15,-3).
7. **Color Usage** — Background colors should be subtle. Use accent/primary colors sparingly for CTAs and active states. Text should have sufficient contrast against its background.
`.trim();

const DEFAULT_PALETTE = `
## Default Palette (use when no tokens are defined)

### Colors — Dark Theme (suitable for dashboards, trading apps, data-heavy UIs)
- Background: #0F1117 (page), #1A1D29 (surface/card), #252836 (elevated surface)
- Border: #2E3348 (subtle), #3D4260 (default)
- Text: #FFFFFF (primary), #A0A3B1 (secondary), #6B6F82 (tertiary/muted)
- Accent: #6C5CE7 (primary/purple), #00B894 (success/green), #FF6B6B (danger/red), #FDCB6E (warning/yellow), #0984E3 (info/blue)

### Colors — Light Theme (suitable for content sites, forms, landing pages)
- Background: #FFFFFF (page), #F8F9FA (surface), #F1F3F5 (elevated)
- Border: #E9ECEF (subtle), #DEE2E6 (default)
- Text: #212529 (primary), #495057 (secondary), #868E96 (muted)
- Accent: #6C5CE7 (primary), #00B894 (success), #FF6B6B (danger), #FDCB6E (warning), #0984E3 (info)

### Typography Scale
- Display: 48px / weight 700
- H1: 32px / weight 700
- H2: 24px / weight 600
- H3: 20px / weight 600
- Body: 16px / weight 400
- Small: 14px / weight 400
- Caption: 12px / weight 400
- Overline: 11px / weight 600 / letterSpacing 1

### Spacing Scale
- xs: 4px, sm: 8px, md: 16px, lg: 24px, xl: 32px, 2xl: 48px, 3xl: 64px

### Radii
- sm: 4px, md: 8px, lg: 12px, xl: 16px, full: 9999px

### Shadow Presets
- sm: { offsetX: 0, offsetY: 1, blur: 3, spread: 0, color: "#000000", opacity: 0.12 }
- md: { offsetX: 0, offsetY: 4, blur: 6, spread: -1, color: "#000000", opacity: 0.1 }
- lg: { offsetX: 0, offsetY: 10, blur: 15, spread: -3, color: "#000000", opacity: 0.1 }
`.trim();

const ONE_SHOT_EXAMPLE = `
## Example — Well-Structured Spec

\`\`\`json
{
  "name": "CryptoDashboard",
  "description": "A crypto trading dashboard with portfolio overview and watchlist",
  "width": 1440,
  "height": 900,
  "root": {
    "type": "frame",
    "name": "pageRoot",
    "layout": { "direction": "column", "gap": "0", "alignItems": "stretch" },
    "style": { "fill": "#0F1117" },
    "children": [
      {
        "type": "frame",
        "name": "topBar",
        "layout": { "direction": "row", "gap": "16", "padding": { "top": "12", "right": "24", "bottom": "12", "left": "24" }, "alignItems": "center", "justifyContent": "space-between", "horizontalSizing": "fill", "verticalSizing": "auto" },
        "style": { "fill": "#1A1D29", "shadow": { "type": "dropShadow", "offsetX": 0, "offsetY": 1, "blur": 3, "spread": 0, "color": "#000000", "opacity": 0.12 } },
        "children": [
          { "type": "text", "name": "logo", "text": { "content": "CryptoVault", "fontSize": 20, "fontWeight": 700, "fontFamily": "Inter", "color": "#FFFFFF", "growType": "auto-width" } },
          {
            "type": "frame",
            "name": "navActions",
            "layout": { "direction": "row", "gap": "12", "alignItems": "center", "horizontalSizing": "auto", "verticalSizing": "auto" },
            "children": [
              {
                "type": "frame",
                "name": "searchInput",
                "layout": { "direction": "row", "gap": "8", "padding": "8", "alignItems": "center", "horizontalSizing": "auto", "verticalSizing": "auto" },
                "style": { "fill": "#252836", "cornerRadius": "8", "width": 240, "height": 36, "stroke": "#2E3348", "strokeWidth": "1" },
                "children": [
                  { "type": "text", "name": "searchPlaceholder", "text": { "content": "Search coins...", "fontSize": 14, "fontWeight": 400, "fontFamily": "Inter", "color": "#6B6F82", "growType": "auto-width" } }
                ]
              },
              {
                "type": "frame",
                "name": "profileButton",
                "layout": { "direction": "row", "padding": "8", "alignItems": "center", "justifyContent": "center", "horizontalSizing": "auto", "verticalSizing": "auto" },
                "style": { "fill": "#6C5CE7", "cornerRadius": "9999", "width": 36, "height": 36 },
                "children": [
                  { "type": "text", "name": "profileInitial", "text": { "content": "D", "fontSize": 14, "fontWeight": 600, "fontFamily": "Inter", "color": "#FFFFFF", "align": "center", "growType": "auto-width" } }
                ]
              }
            ]
          }
        ]
      },
      {
        "type": "frame",
        "name": "mainContent",
        "layout": { "direction": "row", "gap": "24", "padding": "24", "alignItems": "start", "horizontalSizing": "fill", "verticalSizing": "fill" },
        "children": [
          {
            "type": "frame",
            "name": "portfolioCard",
            "layout": { "direction": "column", "gap": "16", "padding": "24", "horizontalSizing": "fill", "verticalSizing": "auto" },
            "style": { "fill": "#1A1D29", "cornerRadius": "12", "shadow": { "type": "dropShadow", "offsetX": 0, "offsetY": 4, "blur": 6, "spread": -1, "color": "#000000", "opacity": 0.1 } },
            "children": [
              { "type": "text", "name": "portfolioTitle", "text": { "content": "Portfolio", "fontSize": 20, "fontWeight": 600, "fontFamily": "Inter", "color": "#FFFFFF", "growType": "auto-width" } },
              { "type": "text", "name": "portfolioValue", "text": { "content": "$24,583.00", "fontSize": 32, "fontWeight": 700, "fontFamily": "Inter", "color": "#FFFFFF", "growType": "auto-width" } },
              { "type": "text", "name": "portfolioChange", "text": { "content": "+5.23% today", "fontSize": 14, "fontWeight": 400, "fontFamily": "Inter", "color": "#00B894", "growType": "auto-width" } }
            ]
          },
          {
            "type": "frame",
            "name": "watchlistCard",
            "layout": { "direction": "column", "gap": "12", "padding": "24", "horizontalSizing": "fill", "verticalSizing": "auto" },
            "style": { "fill": "#1A1D29", "cornerRadius": "12", "shadow": { "type": "dropShadow", "offsetX": 0, "offsetY": 4, "blur": 6, "spread": -1, "color": "#000000", "opacity": 0.1 } },
            "children": [
              { "type": "text", "name": "watchlistTitle", "text": { "content": "Watchlist", "fontSize": 20, "fontWeight": 600, "fontFamily": "Inter", "color": "#FFFFFF", "growType": "auto-width" } },
              {
                "type": "frame",
                "name": "coinRow",
                "layout": { "direction": "row", "gap": "12", "padding": { "top": "12", "right": "0", "bottom": "12", "left": "0" }, "alignItems": "center", "justifyContent": "space-between", "horizontalSizing": "fill", "verticalSizing": "auto" },
                "style": {},
                "children": [
                  { "type": "text", "name": "coinName", "text": { "content": "Bitcoin (BTC)", "fontSize": 16, "fontWeight": 500, "fontFamily": "Inter", "color": "#FFFFFF", "growType": "auto-width" } },
                  { "type": "text", "name": "coinPrice", "text": { "content": "$67,432.10", "fontSize": 16, "fontWeight": 600, "fontFamily": "Inter", "color": "#FFFFFF", "align": "right", "growType": "auto-width" } }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}
\`\`\`
`.trim();

const COMPONENT_PATTERNS = `
## Component Patterns

Use these proven patterns as building blocks. Copy and adapt — do not reinvent basic UI elements.

### Button (primary)
\`\`\`json
{"type":"frame","name":"primaryButton","layout":{"direction":"row","gap":"8","padding":{"top":"10","right":"20","bottom":"10","left":"20"},"alignItems":"center","justifyContent":"center","horizontalSizing":"auto","verticalSizing":"auto"},"style":{"fill":"#6C5CE7","cornerRadius":"8"},"children":[{"type":"text","name":"buttonLabel","text":{"content":"Button","fontSize":14,"fontWeight":600,"fontFamily":"Inter","color":"#FFFFFF","growType":"auto-width"}}]}
\`\`\`

### Button (secondary)
\`\`\`json
{"type":"frame","name":"secondaryButton","layout":{"direction":"row","gap":"8","padding":{"top":"10","right":"20","bottom":"10","left":"20"},"alignItems":"center","justifyContent":"center","horizontalSizing":"auto","verticalSizing":"auto"},"style":{"cornerRadius":"8","stroke":"#3D4260","strokeWidth":"1"},"children":[{"type":"text","name":"buttonLabel","text":{"content":"Button","fontSize":14,"fontWeight":600,"fontFamily":"Inter","color":"#A0A3B1","growType":"auto-width"}}]}
\`\`\`

### Button (ghost)
\`\`\`json
{"type":"frame","name":"ghostButton","layout":{"direction":"row","gap":"8","padding":{"top":"10","right":"16","bottom":"10","left":"16"},"alignItems":"center","justifyContent":"center","horizontalSizing":"auto","verticalSizing":"auto"},"style":{"cornerRadius":"8"},"children":[{"type":"text","name":"buttonLabel","text":{"content":"Button","fontSize":14,"fontWeight":500,"fontFamily":"Inter","color":"#6C5CE7","growType":"auto-width"}}]}
\`\`\`

### Input Field
\`\`\`json
{"type":"frame","name":"inputField","layout":{"direction":"row","gap":"8","padding":{"top":"10","right":"12","bottom":"10","left":"12"},"alignItems":"center","horizontalSizing":"fill","verticalSizing":"auto"},"style":{"fill":"#1A1D29","cornerRadius":"8","stroke":"#2E3348","strokeWidth":"1","height":40},"children":[{"type":"text","name":"placeholder","text":{"content":"Placeholder...","fontSize":14,"fontWeight":400,"fontFamily":"Inter","color":"#6B6F82","growType":"auto-width"}}]}
\`\`\`

### Card
\`\`\`json
{"type":"frame","name":"card","layout":{"direction":"column","gap":"16","padding":"24","horizontalSizing":"fill","verticalSizing":"auto"},"style":{"fill":"#1A1D29","cornerRadius":"12","shadow":{"type":"dropShadow","offsetX":0,"offsetY":4,"blur":6,"spread":-1,"color":"#000000","opacity":0.1}},"children":[{"type":"text","name":"cardTitle","text":{"content":"Card Title","fontSize":18,"fontWeight":600,"fontFamily":"Inter","color":"#FFFFFF","growType":"auto-width"}}]}
\`\`\`

### Nav Bar
\`\`\`json
{"type":"frame","name":"navBar","layout":{"direction":"row","gap":"16","padding":{"top":"12","right":"24","bottom":"12","left":"24"},"alignItems":"center","justifyContent":"space-between","horizontalSizing":"fill","verticalSizing":"auto"},"style":{"fill":"#1A1D29","shadow":{"type":"dropShadow","offsetX":0,"offsetY":1,"blur":3,"spread":0,"color":"#000000","opacity":0.12}},"children":[{"type":"text","name":"brand","text":{"content":"AppName","fontSize":18,"fontWeight":700,"fontFamily":"Inter","color":"#FFFFFF","growType":"auto-width"}}]}
\`\`\`

### Table Row
\`\`\`json
{"type":"frame","name":"tableRow","layout":{"direction":"row","gap":"16","padding":{"top":"12","right":"16","bottom":"12","left":"16"},"alignItems":"center","horizontalSizing":"fill","verticalSizing":"auto"},"style":{"stroke":"#2E3348","strokeWidth":"1"},"children":[{"type":"text","name":"cellValue","text":{"content":"Cell","fontSize":14,"fontWeight":400,"fontFamily":"Inter","color":"#A0A3B1","growType":"auto-width"}}]}
\`\`\`

### Badge
\`\`\`json
{"type":"frame","name":"badge","layout":{"direction":"row","padding":{"top":"4","right":"8","bottom":"4","left":"8"},"alignItems":"center","justifyContent":"center","horizontalSizing":"auto","verticalSizing":"auto"},"style":{"fill":"#6C5CE7","cornerRadius":"9999"},"children":[{"type":"text","name":"badgeLabel","text":{"content":"New","fontSize":11,"fontWeight":600,"fontFamily":"Inter","color":"#FFFFFF","growType":"auto-width"}}]}
\`\`\`

### Avatar
\`\`\`json
{"type":"frame","name":"avatar","layout":{"direction":"row","alignItems":"center","justifyContent":"center","horizontalSizing":"auto","verticalSizing":"auto"},"style":{"fill":"#6C5CE7","cornerRadius":"9999","width":40,"height":40},"children":[{"type":"text","name":"avatarInitial","text":{"content":"A","fontSize":16,"fontWeight":600,"fontFamily":"Inter","color":"#FFFFFF","align":"center","growType":"auto-width"}}]}
\`\`\`

### Stat Card
\`\`\`json
{"type":"frame","name":"statCard","layout":{"direction":"column","gap":"8","padding":"20","horizontalSizing":"fill","verticalSizing":"auto"},"style":{"fill":"#1A1D29","cornerRadius":"12","shadow":{"type":"dropShadow","offsetX":0,"offsetY":2,"blur":4,"spread":0,"color":"#000000","opacity":0.1}},"children":[{"type":"text","name":"statLabel","text":{"content":"Total Users","fontSize":12,"fontWeight":500,"fontFamily":"Inter","color":"#6B6F82","growType":"auto-width"}},{"type":"text","name":"statValue","text":{"content":"12,345","fontSize":28,"fontWeight":700,"fontFamily":"Inter","color":"#FFFFFF","growType":"auto-width"}}]}
\`\`\`

### Divider
\`\`\`json
{"type":"rect","name":"divider","style":{"fill":"#2E3348","height":1},"layout":{"horizontalSizing":"fill"}}
\`\`\`
`.trim();

const LAYOUT_TEMPLATES: Record<string, string> = {
  dashboard: "Structure: Top navigation bar (row, space-between) \u2192 Main content area (row) \u2192 Optional left sidebar/nav (column, ~240px fixed) + Right content (column, fill) \u2192 Content organized as stat cards row + data table or card grid below.",
  form: "Structure: Centered container (column, max-width ~480px) \u2192 Optional header/logo \u2192 Form card (column, gap 20) \u2192 Form groups (column, gap 4: label text + input field per group) \u2192 Button row (row, justify-end, gap 12).",
  landing: "Structure: Full-width column \u2192 Hero section (column, center-aligned, large padding, headline + subtitle + CTA buttons in row) \u2192 Feature grid (row, wrap, 3 columns of icon + title + description cards) \u2192 Footer (row, space-between with link groups).",
  settings: "Structure: Top nav \u2192 Main area (row) \u2192 Left sidebar navigation list (column, ~240px, nav items stacked) \u2192 Right content (column, fill) \u2192 Sections (column, gap 32) each with section heading + description + form controls.",
  table: "Structure: Top bar with title + filters/search row (space-between) \u2192 Table container \u2192 Header row (row, bold text, background fill, border-bottom) \u2192 Data rows (column of row items, each with consistent column widths, border-bottom) \u2192 Pagination bar at bottom.",
};

function detectUICategory(description: string): string | null {
  const d = description.toLowerCase();
  if (/dashboard|analytics|overview|monitor|metrics/.test(d)) return "dashboard";
  if (/form|sign.?up|login|register|checkout|wizard/.test(d)) return "form";
  if (/landing|hero|marketing|homepage/.test(d)) return "landing";
  if (/settings|preferences|profile|account|config/.test(d)) return "settings";
  if (/table|list|data.?grid|directory|inventory/.test(d)) return "table";
  return null;
}

const LAYOUT_SPEC_SCHEMA = `
{
  "name": "string — PascalCase board name",
  "description": "string — one-line description of the board",
  "width": "number — board width in px",
  "height": "number — board height in px",
  "root": {
    "type": "frame | text | rect | ellipse | image | component",
    "name": "string — camelCase for layers, PascalCase for components",
    "layout": {
      "direction": "row | column",
      "wrap": "boolean",
      "gap": "string — token ref or px value (e.g. spacing.md or '16')",
      "padding": "string | { top, right, bottom, left } — token refs or px values",
      "alignItems": "start | center | end | stretch",
      "justifyContent": "start | center | end | space-between | space-around",
      "flexGrow": "number",
      "flexShrink": "number",
      "horizontalSizing": "auto | fill | fix — how this child sizes in parent's main axis",
      "verticalSizing": "auto | fill | fix — how this child sizes in parent's cross axis",
      "gridTemplate": { "columns": "string", "rows": "string", "areas": ["string"] }
    },
    "style": {
      "fill": "string — token ref or hex color",
      "stroke": "string — token ref or hex color",
      "strokeWidth": "string — token ref or px value",
      "cornerRadius": "string — token ref or px value",
      "shadow": "string (token ref) | ShadowProperties | ShadowProperties[] — where ShadowProperties = { type?: 'dropShadow'|'innerShadow', offsetX, offsetY, blur, spread, color, opacity? }",
      "opacity": "number 0-1",
      "width": "string | number",
      "height": "string | number",
      "minWidth": "string | number",
      "maxWidth": "string | number",
      "minHeight": "string | number",
      "maxHeight": "string | number"
    },
    "children": ["LayoutNode (recursive)"],
    "text": {
      "content": "string — the visible text",
      "typography": "string — token ref (optional if fontSize/fontWeight set)",
      "color": "string — token ref or hex color",
      "align": "left | center | right",
      "fontSize": "number — px size (e.g. 16, 24, 32)",
      "fontWeight": "number — 400 (regular), 500 (medium), 600 (semibold), 700 (bold)",
      "fontFamily": "string — font name (default: Inter)",
      "lineHeight": "number — line height multiplier (e.g. 1.5)",
      "letterSpacing": "number — letter spacing in px",
      "growType": "auto-width | auto-height | fixed — how text box sizes"
    },
    "componentRef": "string — name of a component from the index",
    "componentVariant": "string — variant name (e.g. Primary, Ghost)"
  }
}`.trim();

export function buildSpecSystemPrompt(context: SpecPromptContext): string {
  const parts: string[] = [];

  parts.push(`You are Vectis, an expert design engineer that generates LayoutSpec JSON for Penpot boards.

Your output MUST be a single valid JSON object matching the LayoutSpec schema below. Do NOT include any text outside the JSON — no markdown fences, no commentary.

${DESIGN_PRINCIPLES}

## LayoutSpec Schema

${LAYOUT_SPEC_SCHEMA}

## Rules

1. **Color & spacing values** — ${context.tokenSets.length > 0 ? 'Every color, spacing, typography, radius, shadow, and stroke value MUST be a token reference string (e.g. "color.primary", "spacing.lg"). Never use raw hex colors or pixel values.' : 'No design tokens are defined. Use concrete hex colors and px values from the Default Palette below. Do NOT use token reference placeholders like "color.primary" — use actual values like "#6C5CE7".'}
2. **Flex or Grid only** — Every container MUST use \`layout.direction\` (flex) or \`layout.gridTemplate\` (grid). Static positioning and absolute offsets are forbidden.
3. **Component references** — When using an existing component, set \`type: "component"\`, \`componentRef\` to the component name, and optionally \`componentVariant\`. Only reference components that exist in the component index below.
4. **Naming conventions** — PascalCase for component instances and board names. camelCase for generic layer names (frames, rects, text layers).
5. **No empty children** — If a node has a \`children\` array it MUST contain at least one child. Omit \`children\` for leaf nodes.
6. **Reasonable dimensions** — Width and height at the root should be realistic screen sizes (e.g. 375x812 for mobile, 1440x900 for desktop). Child dimensions should be reasonable fractions of their parent.
7. **Semantic structure** — Use descriptive names that convey purpose (headerSection, userAvatar, priceLabel), not generic names (Frame 1, Rectangle 3).
8. **Always set text styling** — Every text node MUST include \`fontSize\`, \`fontWeight\`, and \`fontFamily\` (default "Inter") in its \`text\` properties. Use the typography scale for consistent sizing.
9. **Use child sizing** — Set \`layout.horizontalSizing\` and \`layout.verticalSizing\` on child frames to control how they fill or fit their parent. Use "fill" for full-width sections, "auto" for content-sized elements.
10. **Shadows on cards** — Every card or elevated surface MUST have a shadow (use ShadowProperties object, not a string). This creates visual depth and hierarchy.`);

  // Skills
  if (context.skills.length > 0) {
    parts.push("\n## Active Skills\n");
    for (const skill of context.skills) {
      parts.push(skill);
    }
  }

  // Component index
  if (context.componentNames.length > 0) {
    parts.push("\n## Component Index\n");
    parts.push("These components are available for reference:\n");
    for (const name of context.componentNames) {
      parts.push(`- ${name}`);
    }
  } else {
    parts.push("\n## Component Index\n\nNo components are available yet. Use primitive types (frame, text, rect, ellipse, image) only.");
  }

  // Token sets
  if (context.tokenSets.length > 0) {
    parts.push("\n## Design Tokens\n");
    parts.push("These token sets are available. Use these exact names as token references:\n");
    for (const tokenSet of context.tokenSets) {
      parts.push(tokenSet);
    }
  } else {
    parts.push(`\n${DEFAULT_PALETTE}`);
  }

  // One-shot example
  parts.push(`\n${ONE_SHOT_EXAMPLE}`);

  // Component patterns
  parts.push(`\n${COMPONENT_PATTERNS}`);

  return parts.join("\n");
}

export function buildSpecUserPrompt(context: SpecPromptContext): string {
  const parts: string[] = [];

  parts.push(`Generate a LayoutSpec JSON for the board "${context.boardName}".`);

  if (context.boardDescription) {
    parts.push(`\nDescription: ${context.boardDescription}`);
  }

  if (context.flowContext) {
    parts.push(`\nFlow context:\n${context.flowContext}`);
  }

  // Inject layout template for detected UI category
  if (context.boardDescription) {
    const category = detectUICategory(context.boardDescription);
    if (category) {
      parts.push(`\nStructural template for this type of UI:\n${LAYOUT_TEMPLATES[category]}`);
    }
  }

  // Output instruction
  if (context.useToolUse) {
    parts.push("\nCall the generate_layout_spec tool with the complete LayoutSpec as the argument.");
  } else {
    parts.push("\nRespond with ONLY the JSON object. No markdown, no explanation.");
  }

  return parts.join("\n");
}
