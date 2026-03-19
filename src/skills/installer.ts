import fs from "node:fs";
import path from "node:path";

const BUILT_IN_SKILLS: Record<string, string> = {
  "penpot-layout.md": `---
name: penpot-layout
description: Penpot auto-layout patterns and constraints (flex, grid, responsive)
always: false
tags: [layout, penpot]
---

# Penpot Layout Patterns

When creating or modifying layouts in Penpot:

## Auto Layout (Flex)
- Always use auto-layout (flex) for component internals
- Set direction: row or column
- Use gap tokens, never manual spacing
- Set padding with design tokens
- Align items: start, center, end, stretch

## Grid Layout
- Use grid for page-level layouts and repeated patterns
- Define columns with fr units or fixed + fr mix
- Set row/column gap with tokens
- Use grid areas for complex layouts

## Responsive Considerations
- Use fill containers (flex-grow) for flexible elements
- Set min/max constraints on flex children
- Prefer percentage widths over fixed for adaptable layouts

## Constraints
- Never use absolute positioning (static layout is forbidden)
- Never use raw pixel values — always reference design tokens
- Every spacing value must come from the token set
`,
  "penpot-components.md": `---
name: penpot-components
description: Penpot component creation and variant best practices
always: false
tags: [components, penpot]
---

# Penpot Component Patterns

## Creating Components
- Name with PascalCase: Button, CardHeader, NavigationItem
- Include all states as variants: Default, Hover, Active, Disabled, Focus
- Use slash notation for categories: Button/Primary, Button/Secondary

## Variants
- Use consistent variant properties across similar components
- Define size variants: sm, md, lg
- Define style variants: primary, secondary, outline, ghost
- Include dark/light theme variants if applicable

## Component Structure
- Outermost frame = component boundary with auto-layout
- Internal structure uses nested auto-layout frames
- Text layers use design token typography styles
- Icons use consistent sizing tokens

## Annotations
- Add component annotations describing usage
- Document required vs optional variant properties
- Note accessibility requirements
`,
  "design-tokens.md": `---
name: design-tokens
description: Design token usage rules and validation constraints
always: true
tags: [tokens, validation]
---

# Design Token Rules

## Token Categories
- **color**: All color values must reference color tokens
- **spacing**: All margins, paddings, gaps must use spacing tokens
- **typography**: Font family, size, weight, line-height from type tokens
- **radius**: Border radius values from radius tokens
- **shadow**: Box shadows from shadow tokens
- **sizing**: Fixed dimensions from sizing tokens

## Rules
1. NO raw hex colors (#fff, #000, etc.) — always reference token
2. NO raw pixel values for spacing — always reference spacing token
3. NO inline font definitions — always reference typography token
4. Token names should be semantic: color.primary, not color.blue
5. Component-scoped tokens should extend global tokens
`,
  "naming-contract.md": `---
name: naming-contract
description: Naming conventions for pages, boards, layers, and components
always: true
tags: [naming, conventions]
---

# Naming Contract

## Pages
- PascalCase: Dashboard, Settings, Authentication
- Prefix with ~ to exclude from tracking
- Prefix with _ for scratch/experimental pages

## Boards (Frames)
- PascalCase with optional slash grouping: Dashboard/Home, Settings/Profile
- Suffix with screen size for responsive variants: Login/Mobile, Login/Desktop
- Prefix with ~ or _ to exclude from tracking

## Layers
- camelCase for generic layers: headerSection, mainContent
- PascalCase for component instances: PrimaryButton, UserAvatar
- Descriptive names, never "Frame 1" or "Rectangle 3"

## Components
- PascalCase: Button, Card, NavigationBar
- Variant naming: Component/Variant (Button/Primary, Button/Ghost)
- State naming: Component/State (Button/Hover, Button/Disabled)
`,
  "accessibility.md": `---
name: accessibility
description: Accessibility checks for generated layouts and components
always: false
tags: [a11y, accessibility]
---

# Accessibility Requirements

## Color Contrast
- Text on backgrounds must meet WCAG 2.1 AA: 4.5:1 for normal text, 3:1 for large text
- Interactive elements must have 3:1 contrast against adjacent colors
- Don't rely on color alone to convey information

## Touch Targets
- Minimum 44x44px touch target for mobile
- Minimum 24x24px for desktop interactive elements
- Adequate spacing between adjacent targets

## Typography
- Minimum 16px base font size
- Line height at least 1.5x font size for body text
- Maximum line length ~80 characters

## Structure
- Logical heading hierarchy (h1 > h2 > h3)
- Visible focus indicators on all interactive elements
- Skip navigation patterns for complex pages

## Component Requirements
- All interactive elements need visible labels
- Form inputs need associated labels
- Error states need color + icon + text (not just color)
`,
  "empty-states.md": `---
name: empty-states
description: Patterns for empty states, loading states, and error states
always: false
tags: [states, ux]
---

# UI State Patterns

## Empty States
- Always provide an empty state — never show a blank screen
- Include: illustration/icon + message + primary action
- Message should explain what will appear and how to get started
- Primary action should be the most common way to populate the view

## Loading States
- Use skeleton screens for initial page loads
- Use inline spinners for section refreshes
- Show progress bars for operations >3 seconds
- Never block the entire UI — load sections independently

## Error States
- Show what went wrong in plain language
- Provide a recovery action (retry, go back, contact support)
- Preserve user input when possible
- Use warning/error color tokens with icon + text

## Partial States
- Show available data even when some sections fail
- Indicate which sections failed with inline retry
- Progressive disclosure: show summary, expand for details
`,
};

export function installBuiltInSkills(targetDir: string): void {
  fs.mkdirSync(targetDir, { recursive: true });

  for (const [filename, content] of Object.entries(BUILT_IN_SKILLS)) {
    const filePath = path.join(targetDir, filename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, content);
    }
  }
}
