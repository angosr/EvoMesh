import { leadRoleMdEn, leadLoopMdEn } from "./lead.js";
import { executorRoleMdEn, executorLoopMdEn } from "./executor.js";
import { reviewerRoleMdEn, reviewerLoopMdEn } from "./reviewer.js";
import { coreDevRoleMd, coreDevLoopMd } from "./core-dev.js";
import { frontendRoleMd, frontendLoopMd } from "./frontend.js";
import { agentArchitectRoleMd, agentArchitectLoopMd } from "./agent-architect.js";
import { securityRoleMd, securityLoopMd } from "./security.js";
import { researchRoleMd, researchLoopMd } from "./research.js";
import type { RoleConfig } from "../../config/schema.js";

export interface RoleTemplate {
  roleMd: (projectName: string) => string;
  loopMd: () => string;
  defaultConfig: Omit<RoleConfig, "account">;
}

export const TEMPLATES: Record<string, RoleTemplate> = {
  lead: {
    roleMd: leadRoleMdEn,
    loopMd: leadLoopMdEn,
    defaultConfig: {
      type: "lead", loop_interval: "8m", evolution_upgrade_every: 30,
      scope: [".evomesh/blueprint.md", ".evomesh/status.md", ".evomesh/roles/*/inbox/", "docs/"],
      description: "Project lead — strategy, docs, role coordination",
    },
  },
  executor: {
    roleMd: executorRoleMdEn,
    loopMd: executorLoopMdEn,
    defaultConfig: {
      type: "worker", loop_interval: "5m", evolution_upgrade_every: 20,
      scope: ["src/", "tests/"],
      description: "Code implementation, testing, commits",
    },
  },
  "core-dev": {
    roleMd: coreDevRoleMd,
    loopMd: coreDevLoopMd,
    defaultConfig: {
      type: "worker", loop_interval: "5m", evolution_upgrade_every: 20,
      scope: ["src/", "docker/", "test/"],
      description: "Main feature development — backend, Docker, API",
    },
  },
  frontend: {
    roleMd: frontendRoleMd,
    loopMd: frontendLoopMd,
    defaultConfig: {
      type: "worker", loop_interval: "5m", evolution_upgrade_every: 20,
      scope: ["src/server/frontend*", "src/server/*.html"],
      description: "UI/UX developer — web, mobile, interaction",
    },
  },
  reviewer: {
    roleMd: reviewerRoleMdEn,
    loopMd: reviewerLoopMdEn,
    defaultConfig: {
      type: "worker", loop_interval: "10m", evolution_upgrade_every: 25,
      scope: ["src/", "test/", "docs/"],
      description: "Code review — quality, correctness, best practices",
    },
  },
  "agent-architect": {
    roleMd: agentArchitectRoleMd,
    loopMd: agentArchitectLoopMd,
    defaultConfig: {
      type: "worker", loop_interval: "10m", evolution_upgrade_every: 25,
      scope: [".evomesh/", "docs/"],
      description: "Multi-agent collaboration specialist",
    },
  },
  security: {
    roleMd: securityRoleMd,
    loopMd: securityLoopMd,
    defaultConfig: {
      type: "worker", loop_interval: "15m", evolution_upgrade_every: 25,
      scope: ["src/", "docker/"],
      description: "Security audit — vulnerabilities, hardcodes, injection",
    },
  },
  research: {
    roleMd: researchRoleMd,
    loopMd: researchLoopMd,
    defaultConfig: {
      type: "worker", loop_interval: "15m", evolution_upgrade_every: 25,
      scope: ["devlog/", "docs/"],
      description: "Frontier research — papers, open source, trends",
    },
  },
};

export const TEMPLATE_NAMES = Object.keys(TEMPLATES);
