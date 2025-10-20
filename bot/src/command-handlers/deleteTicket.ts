import {
  APIApplicationCommandInteraction,
  ComponentType,
} from "discord-api-types/v10";
import {
  deleteResponse,
  sendMessage,
  updateResponse,
} from "../adapters/discord-adapter";
import { isActorAdmin, isActorRecruiter } from "../component-handlers/utils";
import { BUTTONS } from "../component-handlers/buttons";
import { getConfig } from "../util/serverConfig";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

export const deleteTicket = async (
  interaction: APIApplicationCommandInteraction
) => {
  try {
    const config = getConfig(interaction.guild_id!);
    if (await isTicketChannel(interaction)) {
      if (
        (await isActorAdmin(
          interaction.guild_id!,
          interaction.member!.user.id,
          config
        )) ||
        (await isActorRecruiter(
          interaction.guild_id!,
          interaction.member!.user.id,
          config
        ))
      ) {
        await updateResponse(interaction.application_id, interaction.token, {
          content: "Are you sure you want to delete this ticket?",
          components: [
            {
              type: ComponentType.ActionRow,
              components: [BUTTONS.CONFIRM_DELETE, BUTTONS.REJECT_DELETE],
            },
          ],
        });
      } else {
        await sendMessage(
          {
            content: `You do not have permissions to delete this ticket <@${interaction.member?.user.id}>`,
          },
          interaction.channel.id
        );
        await deleteResponse(interaction.application_id, interaction.token);
      }
    } else {
      await sendMessage(
        {
          content: `This is not an application channel <@${
            interaction.member!.user.id
          }>`,
        },
        interaction.channel.id
      );
      await deleteResponse(interaction.application_id, interaction.token);
    }
  } catch (err) {
    console.error(`Failed to delete ticket: ${err}`);
    await updateResponse(interaction.application_id, interaction.token, {
      content:
        "There was an issue initializing deletion of this ticket, please try again or reach out to admins",
    });
  }
};

const isTicketChannel = async (interaction: APIApplicationCommandInteraction) => {
  const ticketData = (await dynamoDbClient.send(
    new GetCommand({
      TableName: "BotTable",
      Key: {
        pk: interaction.guild_id!,
        sk: 'tickets'
      }
    })
  )).Item!;

  if (ticketData.tickets.find((ticket: Record<string, any>) => ticket.ticketChannel === interaction.channel.id)) {
    return true;
  } else {  
    return interaction.channel.name!.includes("\u{1F39F}") 
    || interaction.channel.name!.includes("\u{2705}");
  }
};
