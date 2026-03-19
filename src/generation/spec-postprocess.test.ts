import { describe, it, expect } from "vitest";
import { postProcessSpec } from "./spec-postprocess.js";
import type { LayoutSpec } from "./types.js";

function makeSpec(root: Record<string, unknown>): LayoutSpec {
  return {
    name: "Test",
    description: "test",
    width: 1440,
    height: 900,
    root: root as LayoutSpec["root"],
  };
}

describe("postProcessSpec", () => {
  describe("Rule 1: snap to 4px grid", () => {
    it("snaps gap to nearest 4px", () => {
      const spec = makeSpec({
        type: "frame",
        name: "container",
        layout: { direction: "column", gap: "15" },
        children: [
          {
            type: "text",
            name: "label",
            text: {
              content: "Hi",
              fontSize: 16,
              fontWeight: 400,
              fontFamily: "Inter",
              growType: "auto-width",
            },
          },
        ],
      });
      const { spec: result, fixes } = postProcessSpec(spec);
      expect(result.root.layout?.gap).toBe("16");
      expect(fixes.some((f) => f.includes("snapped gap"))).toBe(true);
    });

    it("snaps padding string to nearest 4px", () => {
      const spec = makeSpec({
        type: "frame",
        name: "container",
        layout: { direction: "column", padding: "13" },
        children: [
          {
            type: "text",
            name: "label",
            text: {
              content: "Hi",
              fontSize: 16,
              fontWeight: 400,
              fontFamily: "Inter",
              growType: "auto-width",
            },
          },
        ],
      });
      const { spec: result } = postProcessSpec(spec);
      expect(result.root.layout?.padding).toBe("12");
    });

    it("snaps object padding values", () => {
      const spec = makeSpec({
        type: "frame",
        name: "container",
        layout: {
          direction: "column",
          padding: { top: "13", right: "17", bottom: "10", left: "24" },
        },
        children: [
          {
            type: "text",
            name: "label",
            text: {
              content: "Hi",
              fontSize: 16,
              fontWeight: 400,
              fontFamily: "Inter",
              growType: "auto-width",
            },
          },
        ],
      });
      const { spec: result } = postProcessSpec(spec);
      const p = result.root.layout?.padding as {
        top?: string;
        right?: string;
        bottom?: string;
        left?: string;
      };
      expect(p.top).toBe("12");
      expect(p.right).toBe("16");
      expect(p.bottom).toBe("12"); // 10/4=2.5 rounds to 3 → 3*4=12
    });

    it("snaps cornerRadius", () => {
      const spec = makeSpec({
        type: "frame",
        name: "card",
        style: { cornerRadius: "11" },
        layout: { direction: "column" },
        children: [
          {
            type: "text",
            name: "label",
            text: {
              content: "Hi",
              fontSize: 16,
              fontWeight: 400,
              fontFamily: "Inter",
              growType: "auto-width",
            },
          },
        ],
      });
      const { spec: result } = postProcessSpec(spec);
      expect(result.root.style?.cornerRadius).toBe("12");
    });

    it("leaves token references untouched", () => {
      const spec = makeSpec({
        type: "frame",
        name: "container",
        layout: { direction: "column", gap: "spacing.md" },
        children: [
          {
            type: "text",
            name: "label",
            text: {
              content: "Hi",
              fontSize: 16,
              fontWeight: 400,
              fontFamily: "Inter",
              growType: "auto-width",
            },
          },
        ],
      });
      const { spec: result } = postProcessSpec(spec);
      expect(result.root.layout?.gap).toBe("spacing.md");
    });

    it("leaves values already on grid untouched", () => {
      const spec = makeSpec({
        type: "frame",
        name: "container",
        layout: { direction: "column", gap: "16" },
        children: [
          {
            type: "text",
            name: "label",
            text: {
              content: "Hi",
              fontSize: 16,
              fontWeight: 400,
              fontFamily: "Inter",
              growType: "auto-width",
            },
          },
        ],
      });
      const { fixes } = postProcessSpec(spec);
      expect(fixes.filter((f) => f.includes("snapped"))).toHaveLength(0);
    });
  });

  describe("Rule 2: enforce min sizes", () => {
    it("enforces min height on buttons", () => {
      const spec = makeSpec({
        type: "frame",
        name: "root",
        layout: { direction: "column" },
        children: [
          {
            type: "frame",
            name: "submitButton",
            style: { height: 24 },
            layout: { direction: "row" },
            children: [
              {
                type: "text",
                name: "label",
                text: {
                  content: "Submit",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: "Inter",
                  growType: "auto-width",
                },
              },
            ],
          },
        ],
      });
      const { spec: result, fixes } = postProcessSpec(spec);
      expect(result.root.children![0].style?.height).toBe(32);
      expect(fixes.some((f) => f.includes("enforced min height"))).toBe(true);
    });

    it("enforces min height on inputs", () => {
      const spec = makeSpec({
        type: "frame",
        name: "root",
        layout: { direction: "column" },
        children: [
          {
            type: "frame",
            name: "emailInput",
            style: { height: 20 },
            layout: { direction: "row" },
            children: [
              {
                type: "text",
                name: "placeholder",
                text: {
                  content: "Email",
                  fontSize: 14,
                  fontWeight: 400,
                  fontFamily: "Inter",
                  growType: "auto-width",
                },
              },
            ],
          },
        ],
      });
      const { spec: result } = postProcessSpec(spec);
      expect(result.root.children![0].style?.height).toBe(32);
    });

    it("leaves non-interactive elements alone", () => {
      const spec = makeSpec({
        type: "frame",
        name: "root",
        layout: { direction: "column" },
        children: [
          {
            type: "frame",
            name: "decorLine",
            style: { height: 2 },
            layout: { direction: "row" },
            children: [{ type: "rect", name: "line", style: { fill: "#333" } }],
          },
        ],
      });
      const { spec: result } = postProcessSpec(spec);
      expect(result.root.children![0].style?.height).toBe(2);
    });

    it("leaves buttons that already meet min size", () => {
      const spec = makeSpec({
        type: "frame",
        name: "root",
        layout: { direction: "column" },
        children: [
          {
            type: "frame",
            name: "bigButton",
            style: { height: 48 },
            layout: { direction: "row" },
            children: [
              {
                type: "text",
                name: "label",
                text: {
                  content: "OK",
                  fontSize: 16,
                  fontWeight: 600,
                  fontFamily: "Inter",
                  growType: "auto-width",
                },
              },
            ],
          },
        ],
      });
      const { fixes } = postProcessSpec(spec);
      expect(fixes.some((f) => f.includes("enforced min height"))).toBe(false);
    });
  });

  describe("Rule 3: fill text defaults", () => {
    it("adds missing fontFamily, growType, fontSize, fontWeight", () => {
      const spec = makeSpec({
        type: "text",
        name: "label",
        text: { content: "Hello" },
      });
      const { spec: result, fixes } = postProcessSpec(spec);
      expect(result.root.text?.fontFamily).toBe("Inter");
      expect(result.root.text?.growType).toBe("auto-width");
      expect(result.root.text?.fontSize).toBe(16);
      expect(result.root.text?.fontWeight).toBe(400);
      expect(fixes).toHaveLength(4);
    });

    it("does not overwrite existing values", () => {
      const spec = makeSpec({
        type: "text",
        name: "heading",
        text: {
          content: "Title",
          fontFamily: "Roboto",
          fontSize: 32,
          fontWeight: 700,
          growType: "auto-height",
        },
      });
      const { spec: result, fixes } = postProcessSpec(spec);
      expect(result.root.text?.fontFamily).toBe("Roboto");
      expect(result.root.text?.fontSize).toBe(32);
      expect(result.root.text?.fontWeight).toBe(700);
      expect(result.root.text?.growType).toBe("auto-height");
      expect(fixes).toHaveLength(0);
    });
  });

  describe("Rule 4: low contrast warning", () => {
    it("warns on low-contrast text", () => {
      const spec = makeSpec({
        type: "frame",
        name: "root",
        style: { fill: "#1A1D29" },
        layout: { direction: "column" },
        children: [
          {
            type: "text",
            name: "dimText",
            text: {
              content: "Hard to read",
              color: "#252836",
              fontSize: 14,
              fontWeight: 400,
              fontFamily: "Inter",
              growType: "auto-width",
            },
          },
        ],
      });
      const { fixes } = postProcessSpec(spec);
      expect(fixes.some((f) => f.includes("low contrast"))).toBe(true);
    });

    it("does not warn on high-contrast text", () => {
      const spec = makeSpec({
        type: "frame",
        name: "root",
        style: { fill: "#0F1117" },
        layout: { direction: "column" },
        children: [
          {
            type: "text",
            name: "brightText",
            text: {
              content: "Easy to read",
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: 400,
              fontFamily: "Inter",
              growType: "auto-width",
            },
          },
        ],
      });
      const { fixes } = postProcessSpec(spec);
      expect(fixes.some((f) => f.includes("low contrast"))).toBe(false);
    });

    it("skips contrast check for non-hex colors", () => {
      const spec = makeSpec({
        type: "frame",
        name: "root",
        style: { fill: "color.bg" },
        layout: { direction: "column" },
        children: [
          {
            type: "text",
            name: "label",
            text: {
              content: "Token ref",
              color: "color.text",
              fontSize: 14,
              fontWeight: 400,
              fontFamily: "Inter",
              growType: "auto-width",
            },
          },
        ],
      });
      const { fixes } = postProcessSpec(spec);
      expect(fixes.some((f) => f.includes("low contrast"))).toBe(false);
    });
  });

  it("processes nested structures", () => {
    const spec = makeSpec({
      type: "frame",
      name: "root",
      layout: { direction: "column", gap: "15" },
      style: { fill: "#0F1117" },
      children: [
        {
          type: "frame",
          name: "card",
          layout: { direction: "column", gap: "13", padding: "19" },
          style: { fill: "#1A1D29", cornerRadius: "11" },
          children: [
            { type: "text", name: "title", text: { content: "Title" } },
          ],
        },
      ],
    });
    const { spec: result, fixes } = postProcessSpec(spec);
    expect(result.root.layout?.gap).toBe("16");
    expect(result.root.children![0].layout?.gap).toBe("12");
    expect(result.root.children![0].layout?.padding).toBe("20");
    expect(result.root.children![0].style?.cornerRadius).toBe("12");
    // Text should get defaults
    const text = result.root.children![0].children![0];
    expect(text.text?.fontFamily).toBe("Inter");
    expect(fixes.length).toBeGreaterThan(0);
  });
});
