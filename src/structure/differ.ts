import fs from "node:fs";
import path from "node:path";
import type { Logger } from "../utils/logger.js";
import type { StructureAnalysis } from "./analyser.js";

export interface StructureChange {
  type: "added" | "removed" | "modified";
  entity: "flow" | "screen";
  name: string;
  flowName?: string;
  details?: string;
}

export interface StructureDiff {
  changes: StructureChange[];
  hasChanges: boolean;
}

/**
 * Compare existing context files against a new analysis to determine what changed.
 * Used by the --update flag on /structure.
 */
export function diffStructure(
  existing: StructureAnalysis,
  updated: StructureAnalysis,
  logger: Logger,
): StructureDiff {
  const changes: StructureChange[] = [];

  const existingFlowNames = new Set(existing.flows.map((f) => f.name));
  const updatedFlowNames = new Set(updated.flows.map((f) => f.name));

  // Detect added flows
  for (const flow of updated.flows) {
    if (!existingFlowNames.has(flow.name)) {
      changes.push({
        type: "added",
        entity: "flow",
        name: flow.name,
        details: flow.description,
      });
      logger.debug(`Flow added: ${flow.name}`);
    }
  }

  // Detect removed flows
  for (const flow of existing.flows) {
    if (!updatedFlowNames.has(flow.name)) {
      changes.push({
        type: "removed",
        entity: "flow",
        name: flow.name,
        details: flow.description,
      });
      logger.debug(`Flow removed: ${flow.name}`);
    }
  }

  // Detect modified flows (screens changed)
  for (const updatedFlow of updated.flows) {
    const existingFlow = existing.flows.find((f) => f.name === updatedFlow.name);
    if (!existingFlow) continue;

    const existingScreenNames = new Set(existingFlow.screens.map((s) => s.name));
    const updatedScreenNames = new Set(updatedFlow.screens.map((s) => s.name));

    // Added screens
    for (const screen of updatedFlow.screens) {
      if (!existingScreenNames.has(screen.name)) {
        changes.push({
          type: "added",
          entity: "screen",
          name: screen.name,
          flowName: updatedFlow.name,
          details: screen.description,
        });
        logger.debug(`Screen added: ${screen.name} in flow ${updatedFlow.name}`);
      }
    }

    // Removed screens
    for (const screen of existingFlow.screens) {
      if (!updatedScreenNames.has(screen.name)) {
        changes.push({
          type: "removed",
          entity: "screen",
          name: screen.name,
          flowName: updatedFlow.name,
          details: screen.description,
        });
        logger.debug(`Screen removed: ${screen.name} in flow ${updatedFlow.name}`);
      }
    }

    // Modified screens (same name, different description or components)
    for (const updatedScreen of updatedFlow.screens) {
      const existingScreen = existingFlow.screens.find((s) => s.name === updatedScreen.name);
      if (!existingScreen) continue;

      const descChanged = existingScreen.description !== updatedScreen.description;
      const componentsChanged =
        JSON.stringify(existingScreen.components.sort()) !==
        JSON.stringify(updatedScreen.components.sort());

      if (descChanged || componentsChanged) {
        changes.push({
          type: "modified",
          entity: "screen",
          name: updatedScreen.name,
          flowName: updatedFlow.name,
          details: descChanged ? "Description changed" : "Components changed",
        });
        logger.debug(`Screen modified: ${updatedScreen.name} in flow ${updatedFlow.name}`);
      }
    }
  }

  return {
    changes,
    hasChanges: changes.length > 0,
  };
}

/**
 * Read existing structure analysis from context files on disk.
 * Returns null if no context/project.md exists.
 */
export function readExistingAnalysis(
  projectRoot: string,
  logger: Logger,
): StructureAnalysis | null {
  const contextDir = path.join(projectRoot, "context");
  const projectMdPath = path.join(contextDir, "project.md");

  if (!fs.existsSync(projectMdPath)) {
    logger.debug("No existing project.md found");
    return null;
  }

  const projectMd = fs.readFileSync(projectMdPath, "utf-8");

  // Parse project.md to reconstruct a StructureAnalysis
  const projectName = extractHeading(projectMd) ?? "Untitled Project";
  const projectDescription = extractFirstParagraph(projectMd) ?? "";

  // Read flow files
  const flowsDir = path.join(contextDir, "flows");
  const flows: StructureAnalysis["flows"] = [];

  if (fs.existsSync(flowsDir)) {
    const flowFiles = fs.readdirSync(flowsDir).filter((f) => f.endsWith(".md"));
    for (const file of flowFiles) {
      const flowMd = fs.readFileSync(path.join(flowsDir, file), "utf-8");
      const flowName = path.basename(file, ".md");
      const flow = parseFlowMarkdown(flowMd, flowName);
      flows.push(flow);
    }
  }

  // Extract constraints from project.md
  const constraints = extractListSection(projectMd, "Constraints");
  const ambiguities = extractListSection(projectMd, "Notes");

  return {
    projectName,
    projectDescription,
    flows,
    constraints,
    ambiguities,
  };
}

function extractHeading(md: string): string | null {
  const match = md.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function extractFirstParagraph(md: string): string | null {
  const lines = md.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Skip headings and empty lines
    if (line.startsWith("#") || line === "") continue;
    // Skip list items
    if (line.startsWith("-") || line.startsWith("*")) continue;
    return line;
  }
  return null;
}

function extractListSection(md: string, sectionName: string): string[] {
  const sectionRegex = new RegExp(`^##\\s+${sectionName}\\s*$`, "m");
  const match = sectionRegex.exec(md);
  if (!match) return [];

  const afterSection = md.slice(match.index + match[0].length);
  const nextSection = afterSection.search(/^##\s+/m);
  const sectionContent = nextSection >= 0 ? afterSection.slice(0, nextSection) : afterSection;

  const items: string[] = [];
  const lines = sectionContent.split("\n");
  for (const line of lines) {
    const itemMatch = line.match(/^-\s+(.+)$/);
    if (itemMatch) {
      items.push(itemMatch[1].trim());
    }
  }

  return items;
}

function parseFlowMarkdown(
  md: string,
  flowName: string,
): StructureAnalysis["flows"][number] {
  const description = extractFirstParagraph(md) ?? "";

  const screens: StructureAnalysis["flows"][number]["screens"] = [];
  const screenRegex = /^###\s+(.+)$/gm;
  let screenMatch: RegExpExecArray | null;

  while ((screenMatch = screenRegex.exec(md)) !== null) {
    const screenName = screenMatch[1].trim();
    const startIdx = screenMatch.index + screenMatch[0].length;

    // Find next ### or end of file
    const nextScreen = md.indexOf("\n### ", startIdx);
    const screenContent = nextScreen >= 0 ? md.slice(startIdx, nextScreen) : md.slice(startIdx);

    const screenDesc = extractFirstParagraph(screenContent) ?? "";

    // Extract components
    const components: string[] = [];
    const compSection = screenContent.indexOf("**Components:**");
    if (compSection >= 0) {
      const compContent = screenContent.slice(compSection);
      const compLines = compContent.split("\n");
      for (const line of compLines) {
        const compMatch = line.match(/^-\s+(.+)$/);
        if (compMatch) {
          components.push(compMatch[1].trim());
        }
      }
    }

    screens.push({ name: screenName, description: screenDesc, components });
  }

  return { name: flowName, description, screens };
}
