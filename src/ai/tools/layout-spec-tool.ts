/**
 * Tool definition for structured LayoutSpec output via Claude's tool_use.
 * Shallow schema: validates top-level fields, root is generic object
 * (deep validation happens via Zod in spec-validator.ts).
 */
export const LAYOUT_SPEC_TOOL = {
  name: "generate_layout_spec",
  description:
    "Generate a LayoutSpec JSON object for a Penpot design board. The spec defines the visual layout tree including frames, text, shapes, and their styling.",
  input_schema: {
    type: "object" as const,
    properties: {
      name: {
        type: "string",
        description: "PascalCase board name",
      },
      description: {
        type: "string",
        description: "One-line description of the board",
      },
      width: {
        type: "number",
        description:
          "Board width in pixels (e.g. 1440 for desktop, 375 for mobile)",
      },
      height: {
        type: "number",
        description:
          "Board height in pixels (e.g. 900 for desktop, 812 for mobile)",
      },
      root: {
        type: "object",
        description:
          "Root LayoutNode — the frame tree defining the entire board structure. Contains type, name, layout, style, children, and text properties recursively.",
      },
    },
    required: ["name", "description", "width", "height", "root"],
  },
};
