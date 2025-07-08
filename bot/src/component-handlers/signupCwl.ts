import {
  APIMessageComponentInteraction,
  ComponentType,
} from "discord-api-types/v10";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getMessageSender } from "../util/interaction-util";
import { updateResponse } from "../adapters/discord-adapter";

export const signupCwl = async (
  interaction: APIMessageComponentInteraction
) => {
  try {
    const actor = getMessageSender(interaction);
    const accounts = (
      await dynamoDbClient.send(
        new QueryCommand({
          TableName: "BotTable",
          KeyConditionExpression: `pk = :pk AND begins_with(sk, :prefix)`,
          ExpressionAttributeValues: {
            ":pk": actor.id,
            ":prefix": "player#",
          },
        })
      )
    ).Items;
    console.log(JSON.stringify(accounts));
    await updateResponse(interaction.application_id, interaction.token, {
      content: "Select the account you would like to sign up",
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.StringSelect,
              custom_id: "signupAccount",
              placeholder: "Select Account...",
              max_values: 1,
              options: accounts
                ? accounts.map((account) => {
                    return {
                      label: `${account.tag} ${account.username}`,
                      value: account.tag,
                    };
                  })
                : [],
            },
          ],
        },
      ],
    });
  } catch (err) {
    console.log(`Failed to handle signup: ${err}`);
    throw err;
  }
};
