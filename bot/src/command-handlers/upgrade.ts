import {
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
  APIEmbed,
} from "discord-api-types/v10";
import { getCommandOptionData, numberFormat, timeConvert } from "./utils";
import { TROOPS } from "../constants/upgrades/troops";
import { updateMessage } from "../adapters/discord-adapter";

export const handleUpgrade = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  const troop =
    getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
      interaction,
      "troop"
    ).value;
  const upgradeInfo = TROOPS[troop];

  const embed: APIEmbed = {
    title: `${upgradeInfo.type} ${upgradeInfo.name} ${upgradeInfo.emoji}`,
    url: upgradeInfo.wikiUrl,
    description: "Test description",
    fields: upgradeInfo.upgrades.map((upgrade: Record<string, any>) => {
      return {
        name: upgrade.level,
        value: [
          `**Cost:** ${numberFormat(upgrade.cost)}`,
          `**Time:** ${timeConvert(upgrade.time)}`,
        ].join("\n"),
      };
    }),
    footer: {
      text: [
        `**Total Cost:** ${numberFormat(
          upgradeInfo.upgrades.reduce(
            (total: number, upgrade: Record<string, any>) =>
              (total += upgrade.cost),
            0
          )
        )}`,
        `**Total Time:** ${timeConvert(
          upgradeInfo.upgrades.reduce(
            (total: number, upgrade: Record<string, any>) =>
              (total += upgrade.time),
            0
          )
        )}`,
      ].join("\n"),
    },
  };

  await updateMessage(interaction.application_id, interaction.token, {
    embeds: [embed],
  });
};
