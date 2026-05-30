import { dbGet, dbSet, dbDelete, dbGetAll } from "./db";
import { logger } from "../../lib/logger";

const STORE = "rolePanels";

export type PanelType = "button" | "dropdown" | "reaction";
export type PanelMode = "toggle" | "exclusive" | "verify" | "reversed";
export type BtnStyle = "PRIMARY" | "SECONDARY" | "SUCCESS" | "DANGER";

export interface RolePanelRole {
  roleId: string;
  label: string;
  emoji: string;
  buttonStyle: BtnStyle;
  description: string;
  bundleRoles: string[];
  requiredRoles: string[];
  duration: number;
  group: string;
}

export interface RolePanelRestrictions {
  maxRoles: number;
  minAccountAgeDays: number;
  requiredRoles: string[];
  blacklistRoles: string[];
  requiredLevel: number;
}

export interface RolePanel {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string | null;
  type: PanelType;
  title: string;
  description: string;
  color: string;
  thumbnail: string;
  image: string;
  footer: string;
  mode: PanelMode;
  roles: RolePanelRole[];
  restrictions: RolePanelRestrictions;
  logChannelId: string | null;
  createdAt: number;
}

export const DEFAULT_RESTRICTIONS: RolePanelRestrictions = {
  maxRoles: 0,
  minAccountAgeDays: 0,
  requiredRoles: [],
  blacklistRoles: [],
  requiredLevel: 0,
};

// guildId → { panelId → RolePanel }
const cache = new Map<string, Record<string, RolePanel>>();

export async function initRolePanelStore(): Promise<void> {
  const rows = await dbGetAll<Record<string, RolePanel>>(STORE);
  for (const { key, data } of rows) cache.set(key, data ?? {});
  logger.info({ count: rows.length }, "Loaded role panel store from DB");
}

function save(guildId: string): void {
  dbSet(STORE, guildId, cache.get(guildId) ?? {}).catch((err) =>
    logger.error({ err }, "Failed to save role panels")
  );
}

export function getGuildPanels(guildId: string): Record<string, RolePanel> {
  return cache.get(guildId) ?? {};
}

export function getPanel(guildId: string, panelId: string): RolePanel | null {
  return cache.get(guildId)?.[panelId] ?? null;
}

export function savePanel(panel: RolePanel): void {
  if (!cache.has(panel.guildId)) cache.set(panel.guildId, {});
  cache.get(panel.guildId)![panel.id] = panel;
  save(panel.guildId);
}

export function deletePanel(guildId: string, panelId: string): void {
  const guild = cache.get(guildId);
  if (!guild) return;
  delete guild[panelId];
  save(guildId);
}

// messageId → { guildId, panelId }  — rebuilt from cache at startup
export const messagePanelIndex = new Map<string, { guildId: string; panelId: string }>();

export function rebuildMessageIndex(): void {
  messagePanelIndex.clear();
  for (const [guildId, panels] of cache) {
    for (const [panelId, panel] of Object.entries(panels)) {
      if (panel.messageId) {
        messagePanelIndex.set(panel.messageId, { guildId, panelId });
      }
    }
  }
}

export function indexPanel(panel: RolePanel): void {
  if (panel.messageId) {
    messagePanelIndex.set(panel.messageId, { guildId: panel.guildId, panelId: panel.id });
  }
}
