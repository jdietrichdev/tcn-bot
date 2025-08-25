import { getConfig } from "../util/serverConfig";
import { approveApp } from "./approveApp";
import { messageRecruit } from "./messageRecruit";
import { closeRecruit } from "./closeRecruit";
import { closeTicket } from "./closeTicket";
import { deleteTicket } from "./deleteTicket";
import { reopenTicket } from "./reopenTicket";
import { grantRoles } from "./grantRoles";
import { removeRoles } from "./removeRoles";
import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { confirmDelete } from "./confirmDelete";
import { rejectDelete } from "./rejectDelete";
import { signupCwl } from "./signupCwl";
import { exportCwlQuestions } from "./exportCwlQuestions";
import { claimEvent } from "./claim";

export const handleComponent = async (
  interaction: APIMessageComponentInteraction
) => {
  const config = getConfig(interaction.guild_id!);
  const customId = interaction.data.custom_id;
  if (customId === 'approveApp') {
    await approveApp(interaction, config);
  } else if (customId === 'messageRecruit') {
    await messageRecruit(interaction);
  } else if (customId === 'closeRecruit') {
    await closeRecruit(interaction);
  } else if (customId === 'closeTicket') {
    await closeTicket(interaction, config);
  } else if (customId === "deleteTicket") {
    await deleteTicket(interaction, config);
  } else if (customId === 'reopenTicket') {
    await reopenTicket(interaction, config);
  } else if (customId === 'grantRoles') {
    await grantRoles(interaction, config);
  } else if (customId === 'removeRoles') {
    await removeRoles(interaction, config);
  } else if (customId === 'confirmDelete') {
    await confirmDelete(interaction);
  } else if (customId === 'rejectDelete') {
    await rejectDelete(interaction);
  } else if (customId === 'signupCwl') {
    await signupCwl(interaction);
  } else if (customId === 'exportCwlQuestions') {
    await exportCwlQuestions(interaction);
  } else if (customId.startsWith("claim")) {
    await claimEvent(interaction, config);
  }
};
