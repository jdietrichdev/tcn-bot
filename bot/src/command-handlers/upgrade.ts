import {
  APIActionRowComponent,
  APIApplicationCommandInteractionDataStringOption,
  APIButtonComponentWithCustomId,
  APIChatInputApplicationCommandInteraction,
  APIEmbed,
  ButtonStyle,
  ComponentType,
} from "discord-api-types/v10";
import { TROOPS } from "../constants/upgrades/troops";
import { updateResponse } from "../adapters/discord-adapter";
import { MISC } from "../constants/emojis/misc";
import { getCommandOptionData } from "../util/interaction-util";
import { numberFormat, timeConvert } from "../util/format-util";

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
    title: `${upgradeInfo.emoji} ${upgradeInfo.name}`,
    url: upgradeInfo.wikiUrl,
    description: "Test description",
    fields: [
      ...upgradeInfo.upgrades.map((upgrade: Record<string, any>) => {
        return {
          name: `**Level: ${upgrade.level}**`,
          value: [
            `**Cost:** ${upgradeInfo.type}${numberFormat(upgrade.cost)}`,
            `**Time:** ${MISC.CLOCK}${timeConvert(upgrade.time)}`,
          ].join("\n"),
        };
      }),
      {
        name: "Total",
        value: [
          `**Cost:** ${upgradeInfo.type}${numberFormat(
            upgradeInfo.upgrades.reduce(
              (total: number, upgrade: Record<string, any>) =>
                (total += upgrade.cost),
              0
            )
          )}`,
          `**Time:** ${MISC.CLOCK}${timeConvert(
            upgradeInfo.upgrades.reduce(
              (total: number, upgrade: Record<string, any>) =>
                (total += upgrade.time),
              0
            )
          )}`,
        ].join("\n"),
      },
    ],
    footer: {
      text: "Do you have a discount?",
    },
  };

  const discountButtons: APIActionRowComponent<APIButtonComponentWithCustomId> =
    {
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button,
          style: ButtonStyle.Secondary,
          label: "10%",
          custom_id: "10percent",
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Secondary,
          label: "15%",
          custom_id: "15percent",
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Secondary,
          label: "20%",
          custom_id: "20percent",
        },
      ],
    };

  await updateResponse(interaction.application_id, interaction.token, {
    embeds: [embed],
    components: [discountButtons],
  });
};
