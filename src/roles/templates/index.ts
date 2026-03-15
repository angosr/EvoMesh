import { leadRoleMd, leadLoopMd } from "./lead.js";
import { executorRoleMd, executorLoopMd } from "./executor.js";
import { reviewerRoleMd, reviewerLoopMd } from "./reviewer.js";
import type { RoleConfig } from "../../config/schema.js";

export interface RoleTemplate {
  roleMd: (projectName: string) => string;
  loopMd: () => string;
  defaultConfig: Omit<RoleConfig, "account">;
}

export const TEMPLATES: Record<string, RoleTemplate> = {
  lead: {
    roleMd: leadRoleMd,
    loopMd: leadLoopMd,
    defaultConfig: {
      type: "lead",
      loop_interval: "20m",
      evolution_upgrade_every: 30,
      scope: [
        ".evomesh/blueprint.md",
        ".evomesh/status.md",
        ".evomesh/roles/*/inbox/",
        "docs/",
      ],
      description: "项目总控，审查所有角色，维护战略蓝图",
    },
  },
  executor: {
    roleMd: executorRoleMd,
    loopMd: executorLoopMd,
    defaultConfig: {
      type: "worker",
      loop_interval: "10m",
      evolution_upgrade_every: 20,
      scope: ["src/", "tests/"],
      description: "代码实现，测试，提交",
    },
  },
  reviewer: {
    roleMd: reviewerRoleMd,
    loopMd: reviewerLoopMd,
    defaultConfig: {
      type: "worker",
      loop_interval: "15m",
      evolution_upgrade_every: 25,
      scope: ["src/", "tests/", "docs/"],
      description: "代码审查，质量把控",
    },
  },
};

export const TEMPLATE_NAMES = Object.keys(TEMPLATES);
