import {
  APIApplicationCommandAutocompleteInteraction,
  APIApplicationCommandInteractionDataStringOption,
  APICommandAutocompleteInteractionResponseCallbackData,
  InteractionResponseType,
} from "discord-api-types/v10";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { Proposal } from "../util/interfaces";

export const handleNominationResult = async (
  interaction: APIApplicationCommandAutocompleteInteraction
) => {
  const options: APICommandAutocompleteInteractionResponseCallbackData = {
    choices: [],
  };

  const focused = (
    interaction.data
      .options as APIApplicationCommandInteractionDataStringOption[]
  ).find((option) => option.focused);

  if (focused && focused.name === "proposal") {
    const proposals = (
      await dynamoDbClient.send(
        new GetCommand({
          TableName: "BotTable",
          Key: {
            pk: interaction.guild_id!,
            sk: "rank-proposals",
          },
        })
      )
    ).Item!.proposals;

    console.log(JSON.stringify(proposals));

    options.choices = proposals
      .filter((proposal: Proposal) => {
        return !proposal.result;
      })
      .map((proposal: Proposal) => {
        return {
          name: `${proposal.rank} ${proposal.type} - ${proposal.username}`,
          value: proposal.message,
        };
      });

    console.log(options);
  }

  return {
    type: InteractionResponseType.ApplicationCommandAutocompleteResult,
    data: options,
  };
};
