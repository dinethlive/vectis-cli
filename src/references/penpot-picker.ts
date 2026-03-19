import pc from "picocolors";
import type { PenpotBridge } from "../bridge/penpot.js";
import type { PenpotPage, PenpotShape } from "../bridge/types.js";

export interface PickerItem {
  id: string;
  name: string;
  type: "page" | "board" | "layer";
  depth: number;
  children?: PickerItem[];
  expanded?: boolean;
}

export interface PickerResult {
  selectedIds: string[];
  cancelled: boolean;
}

/**
 * Interactive tree browser for Penpot file structure.
 * Navigation: Arrow keys to move, Enter to select, Tab to multi-select,
 * Esc to cancel, "/" to filter.
 */
export class PenpotPicker {
  private items: PickerItem[] = [];
  private flatItems: PickerItem[] = [];
  private cursor = 0;
  private selected = new Set<string>();
  private filterText = "";
  private isFiltering = false;
  private breadcrumb: string[] = [];

  async pick(bridge: PenpotBridge): Promise<PickerResult> {
    const pages = await bridge.getPages();
    this.items = await this.buildTree(bridge, pages);
    this.flatItems = this.flatten(this.items);

    if (this.flatItems.length === 0) {
      console.log(pc.yellow("No items found in Penpot file."));
      return { selectedIds: [], cancelled: true };
    }

    return this.runInteractive();
  }

  private async buildTree(
    bridge: PenpotBridge,
    pages: PenpotPage[],
  ): Promise<PickerItem[]> {
    const tree: PickerItem[] = [];

    for (const page of pages) {
      const pageItem: PickerItem = {
        id: page.id,
        name: page.name,
        type: "page",
        depth: 0,
        children: [],
        expanded: false,
      };

      if (page.shapes) {
        pageItem.children = this.shapesToItems(page.shapes, 1);
      } else {
        try {
          const shapes = await bridge.getShapeTree(page.id);
          pageItem.children = this.shapesToItems(shapes, 1);
        } catch {
          // Could not load shapes for this page
        }
      }

      tree.push(pageItem);
    }

    return tree;
  }

  private shapesToItems(shapes: PenpotShape[], depth: number): PickerItem[] {
    return shapes.map((shape) => {
      const item: PickerItem = {
        id: shape.id,
        name: shape.name,
        type: shape.type === "frame" ? "board" : "layer",
        depth,
        expanded: false,
      };

      if (shape.children && shape.children.length > 0) {
        item.children = this.shapesToItems(shape.children, depth + 1);
      }

      return item;
    });
  }

  private flatten(items: PickerItem[]): PickerItem[] {
    const flat: PickerItem[] = [];
    for (const item of items) {
      flat.push(item);
      if (item.expanded && item.children) {
        flat.push(...this.flatten(item.children));
      }
    }
    return flat;
  }

  private getVisibleItems(): PickerItem[] {
    if (!this.filterText) return this.flatItems;
    const lower = this.filterText.toLowerCase();
    return this.flatItems.filter((item) =>
      item.name.toLowerCase().includes(lower),
    );
  }

  private render(): void {
    const visible = this.getVisibleItems();

    // Clear screen area
    process.stdout.write("\x1B[2J\x1B[H");

    // Breadcrumb
    const crumb =
      this.breadcrumb.length > 0
        ? this.breadcrumb.join(" > ")
        : "Penpot File";
    console.log(pc.bold(pc.cyan(crumb)));
    console.log(
      pc.gray(
        "  [Up/Down] Navigate  [Enter] Select  [Tab] Multi-select  [Esc] Cancel  [/] Filter",
      ),
    );

    if (this.isFiltering) {
      console.log(pc.yellow(`  Filter: ${this.filterText}_`));
    }

    console.log("");

    // Items
    for (let i = 0; i < visible.length; i++) {
      const item = visible[i];
      const indent = "  ".repeat(item.depth + 1);
      const icon = this.getIcon(item);
      const isSelected = this.selected.has(item.id);
      const isCursor = i === this.cursor;

      const checkbox = isSelected ? pc.green("[x]") : pc.gray("[ ]");
      const name = isCursor ? pc.bold(pc.cyan(item.name)) : item.name;
      const pointer = isCursor ? pc.cyan("> ") : "  ";

      console.log(`${pointer}${indent}${checkbox} ${icon} ${name}`);
    }

    if (visible.length === 0) {
      console.log(pc.gray("  (no items match filter)"));
    }

    console.log("");
    console.log(
      pc.gray(
        `  ${this.selected.size} selected | ${visible.length} items`,
      ),
    );
  }

  private getIcon(item: PickerItem): string {
    switch (item.type) {
      case "page":
        return pc.blue("P");
      case "board":
        return pc.magenta("B");
      case "layer":
        return pc.gray("L");
      default:
        return " ";
    }
  }

  private runInteractive(): Promise<PickerResult> {
    return new Promise((resolve) => {
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;

      if (stdin.isTTY) {
        stdin.setRawMode(true);
      }
      stdin.resume();

      this.render();

      const onData = (data: Buffer): void => {
        const key = data.toString();
        const visible = this.getVisibleItems();

        if (this.isFiltering) {
          if (key === "\x1B" || key === "\r" || key === "\n") {
            // Exit filter mode
            this.isFiltering = false;
            this.cursor = 0;
          } else if (key === "\x7F" || key === "\b") {
            // Backspace
            this.filterText = this.filterText.slice(0, -1);
            this.cursor = 0;
          } else if (key.length === 1 && key >= " ") {
            this.filterText += key;
            this.cursor = 0;
          }
          this.render();
          return;
        }

        // Normal mode key handling
        switch (key) {
          case "\x1B[A": // Up arrow
            if (this.cursor > 0) this.cursor--;
            break;

          case "\x1B[B": // Down arrow
            if (this.cursor < visible.length - 1) this.cursor++;
            break;

          case "\r": // Enter — confirm selection
          case "\n": {
            cleanup();
            const currentItem = visible[this.cursor];
            if (this.selected.size === 0 && currentItem) {
              // If nothing explicitly multi-selected, select the cursor item
              resolve({
                selectedIds: [currentItem.id],
                cancelled: false,
              });
            } else {
              resolve({
                selectedIds: Array.from(this.selected),
                cancelled: false,
              });
            }
            return;
          }

          case "\t": {
            // Tab — toggle multi-select
            const item = visible[this.cursor];
            if (item) {
              if (this.selected.has(item.id)) {
                this.selected.delete(item.id);
              } else {
                this.selected.add(item.id);
              }
            }
            break;
          }

          case "\x1B": // Esc — cancel
            cleanup();
            resolve({ selectedIds: [], cancelled: true });
            return;

          case "/": // Start filter
            this.isFiltering = true;
            this.filterText = "";
            break;

          case " ": {
            // Space — toggle expand/collapse
            const currentItem = visible[this.cursor];
            if (currentItem?.children && currentItem.children.length > 0) {
              currentItem.expanded = !currentItem.expanded;
              this.flatItems = this.flatten(this.items);
            }
            break;
          }

          default:
            // Ignore unknown keys
            break;
        }

        this.render();
      };

      stdin.on("data", onData);

      const cleanup = (): void => {
        stdin.removeListener("data", onData);
        if (stdin.isTTY && wasRaw !== undefined) {
          stdin.setRawMode(wasRaw);
        }
        // Clear picker UI
        process.stdout.write("\x1B[2J\x1B[H");
      };
    });
  }
}
