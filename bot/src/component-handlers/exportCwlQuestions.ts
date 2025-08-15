import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { stringify } from "csv-stringify/sync";
import { updateResponse, updateResponseWithAttachment } from "../adapters/discord-adapter";

export const exportCwlQuestions = async (interaction: APIMessageComponentInteraction) => {
    try {
        const questions = (await dynamoDbClient.send(new GetCommand({
            TableName: "BotTable",
            Key: {
                pk: interaction.guild_id!,
                sk: `questions#${interaction.message.embeds[0].title}`,
            },
        }))).Item!;
        console.log(JSON.stringify(questions));

        const records = [['id', 'league', 'availability', 'competitiveness', 'notes']];
        for (const account of questions.accounts) {
            console.log(JSON.stringify(account));
            const row = [
                account.id,
                account.league,
                account.availability,
                account.competitiveness,
                account.notes
            ];
            records.push(row);
        }

        console.log(JSON.stringify(records));

        const csv = stringify(records);
        const blob = new Blob([csv], { type: 'text/csv' });

        const formData = new FormData();
        formData.append('content', `Here are the responses for ${interaction.message.embeds[0].title}`);
        formData.append('files[0]', blob, 'responses.csv');

        await updateResponseWithAttachment(interaction.application_id, interaction.token, formData);
    } catch (err) {
        console.log(`Failed to export CWL question responses: ${err}`);
        throw err;
    }
}