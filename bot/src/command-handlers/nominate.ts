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
    const config = await getConfig(interaction.guild_id!);
    const user =
      getCommandOptionData<APIApplicationCommandInteractionDataUserOption>(
        interaction,
        "user"
      ).value;
    const reasonOption =
      getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
        interaction,
        "reason"
      );
    const reason = "value" in reasonOption ? reasonOption.value : undefined;
    const type = "Promotion"; // Hardcoding as per original request simplification

    const channelId = interaction.channel_id;
    let rank: "Lead" | "Elder" | undefined;

    if (channelId === config.LEAD_PROPOSAL_CHANNEL) {
      rank = "Lead";
    } else if (channelId === config.ELDER_PROPOSAL_CHANNEL) {
      rank = "Elder";
    }

    if (!rank) {
      await updateResponse(interaction.application_id, interaction.token, {
        content:
          "This command can only be used in the lead or elder proposal channels.",
      });
      return;
    }

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
    if (!userData) {
      throw new Error(`Could not retrieve user data for user ID: ${user}`);
    }
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
      rank === "Lead" ? config.LEAD_PROPOSAL_CHANNEL : config.ELDER_PROPOSAL_CHANNEL
    );

    proposalData.proposals.push({
      userId: user,
      username: userData.user.username,
      type,
      rank,
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
  reason?: string
) => {
  let description = `Proposal for ${ 
    user.user.username
  }/${user.nick ?? user.user.username}\nProposed by: ${ 
    interaction.member!.user.username
  }`;
  if (reason) description += `\nReasoning: ${reason}`;
  return {
    title: `${rank} ${type} Proposal`,
    description,
    color: rank === "Lead" ? 0x00ff00 : 0x0000ff,
  } as APIEmbed;
};
