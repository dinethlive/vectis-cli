import fs from "node:fs";
import path from "node:path";
import type { Logger } from "../utils/logger.js";
import type { StructureAnalysis, Flow, FlowScreen } from "./analyser.js";

export interface WriteResult {
  filesWritten: string[];
  directoriesCreated: string[];
}

export function writeStructureFiles(
  projectRoot: string,
  analysis: StructureAnalysis,
  logger: Logger,
): WriteResult {
  const result: WriteResult = {
    filesWritten: [],
    directoriesCreated: [],
  };

  const contextDir = path.join(projectRoot, "context");
  const flowsDir = path.join(contextDir, "flows");
  const screensDir = path.join(contextDir, "screens");

  // Ensure directories exist
  for (const dir of [contextDir, flowsDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      result.directoriesCreated.push(dir);
    }
  }

  // Write project.md
  const projectMd = buildProjectMarkdown(analysis);
  const projectPath = path.join(contextDir, "project.md");
  fs.writeFileSync(projectPath, projectMd, "utf-8");
  result.filesWritten.push(projectPath);
  logger.debug(`Wrote ${projectPath}`);

  // Write flow files
  for (const flow of analysis.flows) {
    const flowMd = buildFlowMarkdown(flow);
    const flowPath = path.join(flowsDir, `${flow.name}.md`);
    fs.writeFileSync(flowPath, flowMd, "utf-8");
    result.filesWritten.push(flowPath);
    logger.debug(`Wrote ${flowPath}`);
  }

  // Write detailed screen files (only if screens have components listed)
  const detailedScreens = analysis.flows.flatMap((flow) =>
    flow.screens
      .filter((s) => s.components.length > 0)
      .map((screen) => ({ screen, flowName: flow.name })),
  );

  if (detailedScreens.length > 0) {
    if (!fs.existsSync(screensDir)) {
      fs.mkdirSync(screensDir, { recursive: true });
      result.directoriesCreated.push(screensDir);
    }

    for (const { screen, flowName } of detailedScreens) {
      const screenMd = buildScreenMarkdown(screen, flowName);
      const screenPath = path.join(screensDir, `${screen.name}.md`);
      fs.writeFileSync(screenPath, screenMd, "utf-8");
      result.filesWritten.push(screenPath);
      logger.debug(`Wrote ${screenPath}`);
    }
  }

  return result;
}

function buildProjectMarkdown(analysis: StructureAnalysis): string {
  const lines: string[] = [];

  lines.push(`# ${analysis.projectName}`);
  lines.push("");
  lines.push(analysis.projectDescription);
  lines.push("");

  // Flows overview
  lines.push("## Flows");
  lines.push("");
  for (const flow of analysis.flows) {
    lines.push(`- **${flow.name}**: ${flow.description}`);
    for (const screen of flow.screens) {
      lines.push(`  - ${screen.name}: ${screen.description}`);
    }
  }
  lines.push("");

  // Constraints
  if (analysis.constraints.length > 0) {
    lines.push("## Constraints");
    lines.push("");
    for (const constraint of analysis.constraints) {
      lines.push(`- ${constraint}`);
    }
    lines.push("");
  }

  // Ambiguities / resolutions
  if (analysis.ambiguities.length > 0) {
    lines.push("## Notes");
    lines.push("");
    for (const ambiguity of analysis.ambiguities) {
      lines.push(`- ${ambiguity}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function buildFlowMarkdown(flow: Flow): string {
  const lines: string[] = [];

  lines.push(`# Flow: ${flow.name}`);
  lines.push("");
  lines.push(flow.description);
  lines.push("");

  lines.push("## Screens");
  lines.push("");

  for (const screen of flow.screens) {
    lines.push(`### ${screen.name}`);
    lines.push("");
    lines.push(screen.description);
    lines.push("");

    if (screen.components.length > 0) {
      lines.push("**Components:**");
      lines.push("");
      for (const component of screen.components) {
        lines.push(`- ${component}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

function buildScreenMarkdown(screen: FlowScreen, flowName: string): string {
  const lines: string[] = [];

  lines.push(`# Screen: ${screen.name}`);
  lines.push("");
  lines.push(`**Flow:** ${flowName}`);
  lines.push("");
  lines.push(screen.description);
  lines.push("");

  if (screen.components.length > 0) {
    lines.push("## Components");
    lines.push("");
    for (const component of screen.components) {
      lines.push(`- ${component}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
