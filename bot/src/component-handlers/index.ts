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
// import { vouchNomination } from "./vouchNomination";
// import { opposeNomination } from "./opposeNomination";
// import { indifferentNomination } from "./indifferentNomination";
import { nominationResults } from "./nominationResults";

export const handleComponent = async (
  interaction: APIMessageComponentInteraction
) => {
  const customId = interaction.data.custom_id;
  if (customId === "approveApp") {
    await approveApp(interaction, getConfig(interaction.guild_id!));
  } else if (customId === "messageRecruit") {
    await messageRecruit(interaction);
  } else if (customId === "closeRecruit") {
    await closeRecruit(interaction);
  } else if (customId === "closeTicket") {
    await closeTicket(interaction, getConfig(interaction.guild_id!));
  } else if (customId === "deleteTicket") {
    await deleteTicket(interaction, getConfig(interaction.guild_id!));
  } else if (customId === "reopenTicket") {
    await reopenTicket(interaction, getConfig(interaction.guild_id!));
  } else if (customId === "grantRoles") {
    await grantRoles(interaction, getConfig(interaction.guild_id!));
  } else if (customId === "removeRoles") {
    await removeRoles(interaction, getConfig(interaction.guild_id!));
  } else if (customId === "confirmDelete") {
    await confirmDelete(interaction);
  } else if (customId === "rejectDelete") {
    await rejectDelete(interaction);
  } else if (customId === "signupCwl") {
    await signupCwl(interaction);
  } else if (customId === "exportCwlQuestions") {
    await exportCwlQuestions(interaction);
  } else if (customId.startsWith("claim")) {
    await claimEvent(interaction);
  // } else if (customId === "vouch") {
  //   await vouchNomination(interaction);
  // } else if (customId === "oppose") {
  //   await opposeNomination(interaction);
  // } else if (customId === "indifferent") {
  //   await indifferentNomination(interaction);
  } else if (customId === "nominationResults") {
    await nominationResults(interaction);
  }
};
