import { Client, Interaction, ButtonInteraction, GuildMember } from "discord.js";
import { logger } from "../../lib/logger";
import { getGiveaway, addEntry, GiveawayEntry } from "../store/giveaways";
import { getUserLevel } from "../store/levels";
import { updateGiveawayEmbed } from "../lib/giveawayManager";

const DAY_MS = 86_400_000;

async function checkRequirements(member: GuildMember, giveaway: any): Promise<string | null> {
  const { requirements } = giveaway;
  const memberRoleIds = [...member.roles.cache.keys()];

  if (requirements.blacklistRoles?.length) {
    for (const roleId of requirements.blacklistRoles) {
      if (memberRoleIds.includes(roleId)) {
        return `❌ You have a blacklisted role (<@&${roleId}>) and cannot enter this giveaway.`;
      }
    }
  }

  if (requirements.requiredRoles?.length) {
    for (const roleId of requirements.requiredRoles) {
      if (!memberRoleIds.includes(roleId)) {
        return `❌ You need the <@&${roleId}> role to enter this giveaway.`;
      }
    }
  }

  if (requirements.minAccountAgeDays > 0) {
    const ageDays = (Date.now() - member.user.createdTimestamp) / DAY_MS;
    if (ageDays < requirements.minAccountAgeDays) {
      const needed = Math.ceil(requirements.minAccountAgeDays - ageDays);
      return `❌ Your account must be at least **${requirements.minAccountAgeDays}** days old. (${needed} days remaining)`;
    }
  }

  if (requirements.minServerAgeDays > 0 && member.joinedTimestamp) {
    const serverAgeDays = (Date.now() - member.joinedTimestamp) / DAY_MS;
    if (serverAgeDays < requirements.minServerAgeDays) {
      const needed = Math.ceil(requirements.minServerAgeDays - serverAgeDays);
      return `❌ You must have been in the server for **${requirements.minServerAgeDays}** days. (${needed} days remaining)`;
    }
  }

  if (requirements.minLevel > 0) {
    const userData = getUserLevel(member.guild.id, member.id);
    if (!userData || userData.level < requirements.minLevel) {
      const current = userData?.level ?? 0;
      return `❌ You need to be level **${requirements.minLevel}** to enter. (You are level ${current})`;
    }
  }

  return null;
}

function calculateBonusEntries(member: GuildMember, giveaway: any): number {
  const { bonus } = giveaway;
  const memberRoleIds = [...member.roles.cache.keys()];
  let extra = 0;

  if (bonus.boosterEnabled && member.premiumSince) {
    extra += bonus.boosterBonus ?? 1;
  }

  for (const rule of (bonus.roleMultipliers ?? [])) {
    if (memberRoleIds.includes(rule.roleId)) {
      extra += rule.bonus;
    }
  }

  if (bonus.levelBonuses?.length) {
    const userData = getUserLevel(member.guild.id, member.id);
    if (userData) {
      for (const lb of bonus.levelBonuses) {
        if (userData.level >= lb.minLevel) {
          extra = Math.max(extra, lb.bonus);
        }
      }
    }
  }

  return extra;
}

async function handleEnter(interaction: ButtonInteraction, giveawayId: string): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const member = interaction.member as GuildMember;
  const guildId = interaction.guildId!;

  const giveaway = getGiveaway(guildId, giveawayId);
  if (!giveaway) {
    return interaction.editReply({ content: "❌ Giveaway not found." });
  }
  if (giveaway.ended || giveaway.cancelled) {
    return interaction.editReply({ content: "❌ This giveaway has already ended." });
  }
  if (Date.now() > giveaway.endsAt) {
    return interaction.editReply({ content: "❌ This giveaway has already ended." });
  }

  const alreadyEntered = giveaway.entries.some(e => e.userId === interaction.user.id);
  if (alreadyEntered) {
    const myEntry = giveaway.entries.find(e => e.userId === interaction.user.id)!;
    return interaction.editReply({
      content: `✅ You are already entered in this giveaway! (${myEntry.totalEntries} ${myEntry.totalEntries === 1 ? "entry" : "entries"})`,
    });
  }

  const err = await checkRequirements(member, giveaway);
  if (err) {
    return interaction.editReply({ content: err });
  }

  const bonusEntries = calculateBonusEntries(member, giveaway);
  const totalEntries = 1 + bonusEntries;

  const entry: GiveawayEntry = {
    userId: interaction.user.id,
    bonusEntries,
    totalEntries,
  };

  const added = await addEntry(guildId, giveawayId, entry);
  if (!added) {
    return interaction.editReply({ content: "✅ You are already entered in this giveaway!" });
  }

  const freshGiveaway = getGiveaway(guildId, giveawayId)!;
  await updateGiveawayEmbed(interaction.client, freshGiveaway).catch(() => {});

  const bonusMsg = bonusEntries > 0 ? ` You have **${totalEntries}** entries (including ${bonusEntries} bonus)!` : "";
  await interaction.editReply({
    content: `🎉 You have entered the giveaway for **${giveaway.prize}**!${bonusMsg}`,
  });
}

export function registerGiveawayButtons(client: Client): void {
  client.on("interactionCreate", async (interaction: Interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.guild) return;

    const { customId } = interaction;
    if (!customId.startsWith("giveaway:")) return;

    try {
      if (customId.startsWith("giveaway:enter:")) {
        const giveawayId = customId.slice("giveaway:enter:".length);
        await handleEnter(interaction, giveawayId);
      }
    } catch (err) {
      logger.error({ err, customId }, "Giveaway button handler failed");
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "❌ Something went wrong.", ephemeral: true }).catch(() => {});
      }
    }
  });
}
