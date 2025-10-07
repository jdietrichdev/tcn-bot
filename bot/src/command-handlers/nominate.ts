import {
  APIApplicationCommandInteractionDataStringOption,
  APIApplicationCommandInteractionDataUserOption,
  APIChatInputApplicationCommandInteraction,
  APIEmbed,
  APIGuildMember,
  ComponentType,
} from "discord-api-types/v10";
import { getCommandOptionData } from "../util/interaction-util";
import {
  getServerUser,
  grantRole,
  sendMessage,
  updateResponse,
} from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getConfig } from "../util/serverConfig";
import { BUTTONS } from "../component-handlers/buttons";
import { Proposal } from "../util/interfaces";

export const handleNominate = async (
  interaction: APIChatInputApplicationCommandInteraction
) => {
  try {
    const config = getConfig(interaction.guild_id!);
    const user =
      getCommandOptionData<APIApplicationCommandInteractionDataUserOption>(
        interaction,
        "user"
      ).value;
    const type =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "type"
      ).value;
    const rank =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "rank"
      ).value;
    const reason =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "reason"
      ).value;

    const proposalData = (
      await dynamoDbClient.send(
        new GetCommand({
          TableName: "BotTable",
          Key: {
            pk: interaction.guild_id!,
            sk: "rank-proposals",
          },
        })
      )
    ).Item ?? {
      pk: interaction.guild_id!,
      sk: "rank-proposals",
      proposals: [],
    };

    if (
      proposalData.proposals.some(
        (proposal: Record<string, any>) =>
          proposal.userId === user &&
          proposal.rank === rank &&
          proposal.type === type
      )
    ) {
      await updateResponse(interaction.application_id, interaction.token, {
        content: `<@${user}> has already been proposed for this, check proposal channel for details`,
      });
      return;
    }

    const userData = await getServerUser(interaction.guild_id!, user);
    const embed = createNominationEmbed(
      interaction,
      userData,
      type,
      rank,
      reason
    );
    const message = await sendMessage(
      {
        embeds: [embed],
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              BUTTONS.VOUCH_NOMINATION,
              BUTTONS.OPPOSE_NOMINATION,
              BUTTONS.INDIFFERENT_NOMINATION,
            ],
          },
          {
            type: ComponentType.ActionRow,
            components: [BUTTONS.NOMINATION_RESULTS],
          },
        ],
      },
      config.RANK_PROPOSAL_CHANNEL
    );

    proposalData.proposals.push({
      userId: user,
      username: userData.user.username,
      rank,
      type,
      reason,
      votes: [],
      proposalTime: new Date().toISOString(),
      proposedBy: interaction.member!.user.username,
      message: message.id,
    } as Proposal);

    await dynamoDbClient.send(
      new PutCommand({
        TableName: "BotTable",
        Item: proposalData,
      })
    );

    if (type === "Promotion") {
      await grantRole(interaction.guild_id!, user, rank === "Elder" ? config.TRIAL_ELDER_ROLE : config.TRIAL_LEAD_ROLE);
    }

    await updateResponse(interaction.application_id, interaction.token, {
      content: "Proposal received, thank you!",
    });
  } catch (err) {
    console.log("Failure handling nominate command", err);
    throw err;
  }
};

const createNominationEmbed = (
  interaction: APIChatInputApplicationCommandInteraction,
  user: APIGuildMember,
  type: string,
  rank: string,
  reason: string
) => {
  let description = `Proposal for ${user.user.username}/${user.user.global_name}\nProposed by: ${
    interaction.member!.user.username
  }`;
  if (reason) description += `\nReasoning: ${reason}`;
  return {
    title: `${rank} ${type} Proposal`,
    description,
  } as APIEmbed;
};
