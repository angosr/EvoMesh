import { leadRoleMd, leadLoopMd } from "./lead.js";
import { executorRoleMd, executorLoopMd } from "./executor.js";
import { reviewerRoleMd, reviewerLoopMd } from "./reviewer.js";
import { leadRoleMdEn, leadLoopMdEn } from "./lead-en.js";
import { executorRoleMdEn, executorLoopMdEn } from "./executor-en.js";
import { reviewerRoleMdEn, reviewerLoopMdEn } from "./reviewer-en.js";
import type { RoleConfig, Lang } from "../../config/schema.js";

export interface RoleTemplate {
  roleMd: (projectName: string) => string;
  loopMd: () => string;
  defaultConfig: Omit<RoleConfig, "account">;
}

const TEMPLATES_ZH: Record<string, RoleTemplate> = {
  lead: {
    roleMd: leadRoleMd,
    loopMd: leadLoopMd,
    defaultConfig: {
      type: "lead", loop_interval: "20m", evolution_upgrade_every: 30,
      scope: [".evomesh/blueprint.md", ".evomesh/status.md", ".evomesh/roles/*/inbox/", "docs/"],
      description: "项目总控，审查所有角色，维护战略蓝图",
    },
  },
  executor: {
    roleMd: executorRoleMd,
    loopMd: executorLoopMd,
    defaultConfig: {
      type: "worker", loop_interval: "10m", evolution_upgrade_every: 20,
      scope: ["src/", "tests/"],
      description: "代码实现，测试，提交",
    },
  },
  reviewer: {
    roleMd: reviewerRoleMd,
    loopMd: reviewerLoopMd,
    defaultConfig: {
      type: "worker", loop_interval: "15m", evolution_upgrade_every: 25,
      scope: ["src/", "tests/", "docs/"],
      description: "代码审查，质量把控",
    },
  },
};

const TEMPLATES_EN: Record<string, RoleTemplate> = {
  lead: {
    roleMd: leadRoleMdEn,
    loopMd: leadLoopMdEn,
    defaultConfig: {
      type: "lead", loop_interval: "20m", evolution_upgrade_every: 30,
      scope: [".evomesh/blueprint.md", ".evomesh/status.md", ".evomesh/roles/*/inbox/", "docs/"],
      description: "Project lead, reviews all roles, maintains strategic blueprint",
    },
  },
  executor: {
    roleMd: executorRoleMdEn,
    loopMd: executorLoopMdEn,
    defaultConfig: {
      type: "worker", loop_interval: "10m", evolution_upgrade_every: 20,
      scope: ["src/", "tests/"],
      description: "Code implementation, testing, commits",
    },
  },
  reviewer: {
    roleMd: reviewerRoleMdEn,
    loopMd: reviewerLoopMdEn,
    defaultConfig: {
      type: "worker", loop_interval: "15m", evolution_upgrade_every: 25,
      scope: ["src/", "tests/", "docs/"],
      description: "Code review, quality assurance",
    },
  },
};

export function getTemplates(lang: Lang = "zh"): Record<string, RoleTemplate> {
  return lang === "en" ? TEMPLATES_EN : TEMPLATES_ZH;
}

// Default export for backward compat
export const TEMPLATES = TEMPLATES_ZH;
export const TEMPLATE_NAMES = Object.keys(TEMPLATES_ZH);
