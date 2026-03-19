import type { StructureAnalysis } from "./analyser.js";
import type { Logger } from "../utils/logger.js";

export interface SkillSuggestion {
  skillName: string;
  reason: string;
}

interface SkillRule {
  skillName: string;
  keywords: string[];
  reason: string;
}

const SKILL_RULES: SkillRule[] = [
  {
    skillName: "accessibility",
    keywords: ["accessibility", "a11y", "aria", "screen reader", "wcag", "contrast"],
    reason: "Project mentions accessibility requirements",
  },
  {
    skillName: "design-tokens",
    keywords: ["tokens", "design system", "design tokens", "theme", "brand colors", "typography scale"],
    reason: "Project references design tokens or a design system",
  },
  {
    skillName: "penpot-layout",
    keywords: ["layout", "responsive", "breakpoint", "grid", "flexbox", "auto-layout", "adaptive"],
    reason: "Project mentions layout or responsive design constraints",
  },
];

export function suggestSkills(
  analysis: StructureAnalysis,
  availableSkills: string[],
  logger: Logger,
): SkillSuggestion[] {
  const suggestions: SkillSuggestion[] = [];
  const availableSet = new Set(availableSkills.map((s) => s.toLowerCase()));

  // Build a searchable text from constraints
  const searchText = [
    ...analysis.constraints,
    analysis.projectDescription,
    ...analysis.ambiguities,
    ...analysis.flows.flatMap((f) => [
      f.description,
      ...f.screens.flatMap((s) => [s.description, ...s.components]),
    ]),
  ]
    .join(" ")
    .toLowerCase();

  for (const rule of SKILL_RULES) {
    // Only suggest skills that are actually available
    if (!availableSet.has(rule.skillName)) {
      logger.debug(`Skill "${rule.skillName}" matched but is not available — skipping`);
      continue;
    }

    const matched = rule.keywords.some((kw) => searchText.includes(kw));
    if (matched) {
      suggestions.push({
        skillName: rule.skillName,
        reason: rule.reason,
      });
      logger.debug(`Suggested skill: ${rule.skillName} — ${rule.reason}`);
    }
  }

  return suggestions;
}
