export function parseDuration(input: string): number | null {
  const re = /(\d+)\s*(d(?:ays?)?|h(?:ours?)?|m(?:in(?:utes?)?)?|s(?:ec(?:onds?)?)?)/gi;
  let total = 0;
  let matched = false;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    const n = parseInt(m[1], 10);
    const unit = m[2][0].toLowerCase();
    matched = true;
    switch (unit) {
      case "d": total += n * 86_400_000; break;
      case "h": total += n * 3_600_000; break;
      case "m": total += n * 60_000; break;
      case "s": total += n * 1_000; break;
    }
  }
  return matched && total > 0 ? total : null;
}

export function formatDuration(ms: number): string {
  const parts: string[] = [];
  const d = Math.floor(ms / 86_400_000); if (d) parts.push(`${d}d`);
  const h = Math.floor((ms % 86_400_000) / 3_600_000); if (h) parts.push(`${h}h`);
  const m = Math.floor((ms % 3_600_000) / 60_000); if (m) parts.push(`${m}m`);
  const s = Math.floor((ms % 60_000) / 1_000); if (s) parts.push(`${s}s`);
  return parts.join(" ") || "0s";
}

export interface ParsedFlags {
  requireRoles: string[];
  blackRoles: string[];
  bonusRoles: Array<{ roleId: string; entries: number }>;
  levelBonuses: Array<{ minLevel: number; bonusEntries: number }>;
  minDays: number;
  minLevel: number;
  boosterBonus: number;
  channel: string | null;
  type: string;
  partnerName: string | null;
  announcementChannel: string | null;
  rest: string[];
}

export function parseFlags(args: string[]): ParsedFlags {
  const result: ParsedFlags = {
    requireRoles: [],
    blackRoles: [],
    bonusRoles: [],
    levelBonuses: [],
    minDays: 0,
    minLevel: 0,
    boosterBonus: 0,
    channel: null,
    type: "normal",
    partnerName: null,
    announcementChannel: null,
    rest: [],
  };

  let i = 0;
  while (i < args.length) {
    const a = args[i];
    switch (a.toLowerCase()) {
      case "--requirerole":
      case "--requiredrole": {
        const next = args[++i];
        if (next) result.requireRoles.push(extractId(next));
        break;
      }
      case "--blackrole":
      case "--blacklistrole": {
        const next = args[++i];
        if (next) result.blackRoles.push(extractId(next));
        break;
      }
      case "--bonusrole": {
        const next = args[++i];
        if (next) {
          const [roleRaw, countRaw] = next.split(":");
          const count = parseInt(countRaw ?? "2", 10);
          result.bonusRoles.push({ roleId: extractId(roleRaw), entries: isNaN(count) ? 2 : count });
        }
        break;
      }
      case "--levelbonus": {
        const next = args[++i];
        if (next) {
          const [lvlRaw, bonusRaw] = next.split(":");
          const lvl = parseInt(lvlRaw, 10);
          const bonus = parseInt(bonusRaw ?? "1", 10);
          if (!isNaN(lvl)) result.levelBonuses.push({ minLevel: lvl, bonusEntries: isNaN(bonus) ? 1 : bonus });
        }
        break;
      }
      case "--mindays": {
        const next = args[++i];
        if (next) result.minDays = parseInt(next, 10) || 0;
        break;
      }
      case "--minlevel": {
        const next = args[++i];
        if (next) result.minLevel = parseInt(next, 10) || 0;
        break;
      }
      case "--booster": {
        const next = args[++i];
        if (next) result.boosterBonus = parseInt(next, 10) || 0;
        break;
      }
      case "--channel": {
        const next = args[++i];
        if (next) result.channel = extractId(next);
        break;
      }
      case "--announce": {
        const next = args[++i];
        if (next) result.announcementChannel = extractId(next);
        break;
      }
      case "--type": {
        const next = args[++i];
        if (next) result.type = next.toLowerCase();
        break;
      }
      case "--partner": {
        const parts: string[] = [];
        i++;
        while (i < args.length && !args[i].startsWith("--")) {
          parts.push(args[i++]);
        }
        result.partnerName = parts.join(" ") || null;
        i--;
        break;
      }
      default:
        result.rest.push(a);
    }
    i++;
  }
  return result;
}

function extractId(raw: string): string {
  return raw.replace(/[<#@&>]/g, "");
}
