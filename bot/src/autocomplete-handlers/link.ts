import { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteractionDataStringOption, APIApplicationCommandInteractionDataSubcommandOption, APICommandAutocompleteInteractionResponseCallbackData } from "discord-api-types/v10";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { getMessageSender } from "../util/interaction-util";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

export const handleLink = async (interaction: APIApplicationCommandAutocompleteInteraction) => {
    const options: APICommandAutocompleteInteractionResponseCallbackData = {
        choices: [],
    }

    const remove = (
        interaction.data.options as APIApplicationCommandInteractionDataSubcommandOption[]
    ).find((option) => option.name === 'remove');

    const focused = (
        remove?.options as APIApplicationCommandInteractionDataStringOption[]
    ).find((option) => option.focused);

    const user = getMessageSender(interaction);

    if (focused && focused.name === 'tag') {
        const accounts = (await dynamoDbClient.send(
            new QueryCommand({
                TableName: "BotTable",
                KeyConditionExpression: "pk = :userId",
                ExpressionAttributeValues: {
                    ":userId": user
                }
            })
        )).Items;

        options.choices = accounts?.map((account) => {
            return {
                name: account.tag,
                value: account.tag,
            }
        })
    }

    return options;
}