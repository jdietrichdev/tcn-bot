import {
  APIChatInputApplicationCommandInteraction,
  APIEmbed,
} from "discord-api-types/v10";
import { deferResponse, updateResponse, sendMessage } from "../adapters/discord-adapter";
import { getConfig } from "../util/serverConfig";

export const handleInfoCwl = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    try {
      await deferResponse(interaction.id, interaction.token);
    } catch (deferErr) {
      console.warn(`Failed to defer response: ${deferErr}, continuing anyway`);
    }

    const guildId = interaction.guild_id!;
    const config = getConfig(guildId);

    const embed = buildCwlInfoEmbed();

    const roleIds = [
      config.CWL_GENERAL_ROLE,
      config.TCN1_ROLE,
      config.TCN2_ROLE,
      config.TCN3_ROLE,
      config.TCN4_ROLE,
      config.TCN5_ROLE,
      config.TCN6_ROLE,
      config.ORES_ROLE,
    ];

    const mentions = roleIds
      .filter((id) => id && id.length > 0)
      .map((id) => `<@&${id}>`)
      .join(" ");

    await sendMessage(
      {
        content: mentions || "",
        embeds: [embed],
      },
      config.ANNOUNCEMENT_CHANNEL
    );

    await updateResponse(interaction.application_id, interaction.token, {
      content: `CWL info posted to <#${config.ANNOUNCEMENT_CHANNEL}>`,
    });
  } catch (err) {
    console.error(`Failed to post CWL info: ${err}`);
    try {
      await updateResponse(interaction.application_id, interaction.token, {
        content:
          "There was a failure posting the CWL info, please try again or contact admins for assistance",
      });
    } catch (updateErr) {
      console.error(`Failed to send error response: ${updateErr}`);
    }
  }
};

const buildCwlInfoEmbed = (): APIEmbed => {
  return {
    title: "CWL Information",
    color: 0x9b59b6,
    description:
      "Important rules, roles, and information about Clash War League",
    fields: [
      {
        name: "General CWL Rules :noted:",
        value: `‣ Use every attack!
‣ You do not have to attack your mirrored opponent!
‣ Attack at least 2 hours before the end of each war so that leads have ample time to prepare for the next day!
‣ Consult your CWL lead on strategies and/or how to attack! (CWL leads outlined in a darker shade)`,
        inline: false,
      },
      {
        name: "CWL GOAT :league_king:",
        value: `The most prestigious role a member could ask for in this server. Given to those exceptional members that have gone perfect in a champions league CWL*
Note: If you were unwillingly subbed out on the first day of CWL and go perfect for the remaining 6 days, you will also be qualified for CWL GOAT.`,
        inline: false,
      },
      {
        name: "CWL LAMB :lamb:",
        value: `This role is to signify the weak, and that it is time to undergo some training to become better! This is to threaten you, as we know all sorts of things can happen! Just a visual indicator so you know to step up your game for next month!

You will receive CWL LAMB if you have ANY of the following:
‣ A missed attack in CWL
‣ If you hit an already attacked base
‣ A CWL hit rate of 2.33 stars or less (total stars/number of days you were in)

PLEASE NOTE: If you obtain CWL LAMB three times in a row, you WILL be kicked out of the family!
You must wait at least one month before we look at your ticket!`,
        inline: false,
      },
      {
        name: "Special Roles :warattack:",
        value: `**@🦣[ This Champion Now ]🦣**: Receive CWL GOAT 3 times in a Champion 1 CWL league account

**@🪚[ The Butcher ]🪚**: CWL GOAT 5 times consecutively, OR CWL GOAT on 5 accounts within the same month

**@🌋 [ God Of War ] 🌋**: Receive CWL GOAT, and three star all wars (both ore and normal wars), hitting only top 20 th18 bases in the month. Opting out will forfeit your chance to obtain this role for the month

**@🧎🏻‍➡️[ This Conqueror Now ]🧎🏼**: Receive GOD of WAR, CWL in a champions 1 league, and end top 5 EOS`,
        inline: false,
      },
    ],
  };
};
