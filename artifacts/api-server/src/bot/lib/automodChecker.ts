import { Message } from "discord.js";
import { getAutomodConfig } from "../store/automod";

// In-memory state for rate-based detections
const spamTimestamps    = new Map<string, number[]>();
const duplicateHistory  = new Map<string, string[]>();
const linkTimestamps    = new Map<string, number[]>();

function userKey(guildId: string, userId: string) {
  return `${guildId}:${userId}`;
}

const INVITE_RE  = /discord(?:\.gg|(?:app)?\.com\/invite)\/[a-zA-Z0-9-]+/i;

function wildcardMatch(pattern: string, text: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(escaped, "i").test(text);
}
const URL_RE     = /https?:\/\/(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+)/gi;
const EMOJI_RE   = /(<a?:\w+:\d+>|\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;

function maxRunLength(s: string): number {
  if (s.length === 0) return 0;
  let max = 1, cur = 1;
  for (let i = 1; i < s.length; i++) {
    cur = s[i] === s[i - 1] ? cur + 1 : 1;
    if (cur > max) max = cur;
  }
  return max;
}

function extractDomains(content: string): string[] {
  const domains: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(URL_RE.source, "gi");
  while ((m = re.exec(content)) !== null) {
    const domain = m[1]?.toLowerCase().replace(/^www\./, "");
    if (domain) domains.push(domain);
  }
  return domains;
}

export interface AutomodResult {
  triggered: true;
  module: string;
  reason: string;
  /** Safe version of the reason for posting publicly in the server (no sensitive content like the blocked word). Falls back to `reason` if not set. */
  publicReason?: string;
}
export interface AutomodPass {
  triggered: false;
}
export type AutomodCheck = AutomodResult | AutomodPass;

export function checkMessage(message: Message): AutomodCheck {
  if (!message.guild) return { triggered: false };

  const guildId   = message.guild.id;
  const userId    = message.author.id;
  const channelId = message.channelId;
  const key       = userKey(guildId, userId);
  const cfg       = getAutomodConfig(guildId);
  const content   = message.content;
  const lower     = content.toLowerCase();

  // ── Exempt channels & roles ──────────────────────────────────────────────
  if (cfg.exemptChannels.includes(channelId)) return { triggered: false };

  if (message.member && cfg.exemptRoles.length > 0) {
    const memberRoles = [...message.member.roles.cache.keys()];
    if (memberRoles.some((r) => cfg.exemptRoles.includes(r))) return { triggered: false };
  }

  // Per-channel module exemptions: only skip specific modules for this channel
  const channelSkipped = new Set<string>(cfg.channelModuleExempts?.[channelId] ?? []);

  // ── Word filter ──────────────────────────────────────────────────────────
  if (cfg.filter.enabled && !channelSkipped.has("filter")) {
    if (cfg.filter.words.length > 0) {
      const hit = cfg.filter.words.find((w) => lower.includes(w));
      if (hit) return { triggered: true, module: "Word Filter", reason: `Blocked word: \`${hit}\``, publicReason: "Used a filtered word" };
    }
    const wildcardWords = cfg.filter.wildcardWords ?? [];
    if (wildcardWords.length > 0) {
      const hit = wildcardWords.find((w) => wildcardMatch(w, lower));
      if (hit) return { triggered: true, module: "Word Filter", reason: `Wildcard pattern matched: \`${hit}\``, publicReason: "Used a filtered word" };
    }
  }

  // ── Anti-invite ──────────────────────────────────────────────────────────
  if (cfg.invite.enabled && !channelSkipped.has("invite") && INVITE_RE.test(content)) {
    return { triggered: true, module: "Anti-Invite", reason: "Posted a Discord invite link" };
  }

  // ── Anti-mention ─────────────────────────────────────────────────────────
  if (cfg.mention.enabled && !channelSkipped.has("mention")) {
    const userRoleMentions = (content.match(/<@[!&]?\d+>/g) ?? []).length;
    const everyoneHere     = (content.match(/@(everyone|here)/g) ?? []).length;
    const mentionCount     = userRoleMentions + everyoneHere;
    if (mentionCount >= cfg.mention.threshold) {
      return {
        triggered: true,
        module: "Anti-Mention",
        reason: `Mass mention (${mentionCount} mention${mentionCount === 1 ? "" : "s"}, limit ${cfg.mention.threshold})`,
      };
    }
  }

  // ── Anti-spam ────────────────────────────────────────────────────────────
  if (cfg.spam.enabled && !channelSkipped.has("spam")) {
    const now        = Date.now();
    const window     = cfg.spam.windowMs;
    const limit      = cfg.spam.limit;
    const timestamps = (spamTimestamps.get(key) ?? []).filter((t) => now - t < window);
    timestamps.push(now);
    spamTimestamps.set(key, timestamps);
    if (timestamps.length >= limit) {
      spamTimestamps.set(key, []);
      return {
        triggered: true,
        module: "Anti-Spam",
        reason: `Sent ${limit} messages within ${window / 1000}s`,
      };
    }
  }

  // ── Anti-duplicate ───────────────────────────────────────────────────────
  if (cfg.duplicate.enabled && !channelSkipped.has("duplicate")) {
    const limit      = cfg.duplicate.count;
    const history    = duplicateHistory.get(key) ?? [];
    const normalized = content.trim().toLowerCase();
    if (normalized.length > 0) {
      const matchCount = history.filter((m) => m === normalized).length + 1;
      const updated    = [...history.slice(-(limit * 2)), normalized];
      duplicateHistory.set(key, updated);
      if (matchCount >= limit) {
        duplicateHistory.set(key, []);
        return {
          triggered: true,
          module: "Anti-Duplicate",
          reason: `Sent the same message ${matchCount} times`,
        };
      }
    }
  }

  // ── Char / emoji flood ───────────────────────────────────────────────────
  if (cfg.charFlood.enabled && !channelSkipped.has("charFlood")) {
    const { maxRepeat, maxEmoji } = cfg.charFlood;

    if (maxRepeat > 0) {
      const run = maxRunLength(content);
      if (run >= maxRepeat) {
        return {
          triggered: true,
          module: "Char Flood",
          reason: `Message contains ${run} consecutive repeated characters (limit ${maxRepeat})`,
        };
      }
    }

    if (maxEmoji > 0) {
      const emojiCount = (content.match(EMOJI_RE) ?? []).length;
      if (emojiCount >= maxEmoji) {
        return {
          triggered: true,
          module: "Emoji Flood",
          reason: `Message contains ${emojiCount} emoji (limit ${maxEmoji})`,
        };
      }
    }
  }

  // ── Link / attachment spam ────────────────────────────────────────────────
  if (cfg.linkSpam.enabled && !channelSkipped.has("linkSpam")) {
    const hasLink        = URL_RE.test(content);
    const hasAttachment  = message.attachments.size > 0;
    URL_RE.lastIndex     = 0; // reset stateful regex

    if (hasLink || hasAttachment) {
      const now        = Date.now();
      const window     = cfg.linkSpam.windowMs;
      const limit      = cfg.linkSpam.limit;
      const timestamps = (linkTimestamps.get(key) ?? []).filter((t) => now - t < window);
      timestamps.push(now);
      linkTimestamps.set(key, timestamps);
      if (timestamps.length >= limit) {
        linkTimestamps.set(key, []);
        return {
          triggered: true,
          module: "Link Spam",
          reason: `Posted ${limit} links or attachments within ${window / 1000}s`,
        };
      }
    }
  }

  // ── Wall text ────────────────────────────────────────────────────────────
  if (cfg.wallText.enabled && !channelSkipped.has("wallText")) {
    const { maxLength, maxLines } = cfg.wallText;
    if (maxLength > 0 && content.length >= maxLength) {
      return {
        triggered: true,
        module: "Wall Text",
        reason: `Message is too long (${content.length} characters, limit ${maxLength})`,
      };
    }
    if (maxLines > 0) {
      const lineCount = content.split("\n").length;
      if (lineCount >= maxLines) {
        return {
          triggered: true,
          module: "Wall Text",
          reason: `Message has too many lines (${lineCount} lines, limit ${maxLines})`,
        };
      }
    }
  }

  // ── URL / domain filter ──────────────────────────────────────────────────
  if (cfg.urlFilter.enabled && !channelSkipped.has("urlFilter") && cfg.urlFilter.domains.length > 0) {
    const domains = extractDomains(content);
    if (domains.length > 0) {
      if (cfg.urlFilter.mode === "blacklist") {
        const blocked = domains.find((d) =>
          cfg.urlFilter.domains.some((bd) => d === bd || d.endsWith(`.${bd}`))
        );
        if (blocked) {
          return {
            triggered: true,
            module: "URL Filter",
            reason: `Blocked domain: \`${blocked}\``,
          };
        }
      } else {
        // whitelist: block any domain NOT in the whitelist
        const notAllowed = domains.find(
          (d) => !cfg.urlFilter.domains.some((wd) => d === wd || d.endsWith(`.${wd}`))
        );
        if (notAllowed) {
          return {
            triggered: true,
            module: "URL Filter",
            reason: `Domain not whitelisted: \`${notAllowed}\``,
          };
        }
      }
    }
  }

  return { triggered: false };
}
