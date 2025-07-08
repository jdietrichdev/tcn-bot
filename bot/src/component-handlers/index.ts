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

export const handleComponent = async (
  interaction: APIMessageComponentInteraction
) => {
  const config = getConfig(interaction.guild_id!);
  switch (interaction.data.custom_id) {
    case "approveApp":
      await approveApp(interaction, config);
      break;
    case "messageRecruit":
      await messageRecruit(interaction);
      break;
    case "closeRecruit":
      await closeRecruit(interaction);
      break;
    case "closeTicket":
      await closeTicket(interaction, config);
      break;
    case "deleteTicket":
      await deleteTicket(interaction, config);
      break;
    case "reopenTicket":
      await reopenTicket(interaction, config);
      break;
    case "grantRoles":
      await grantRoles(interaction, config);
      break;
    case "removeRoles":
      await removeRoles(interaction, config);
      break;
    case "confirmDelete":
      await confirmDelete(interaction);
      break;
    case "rejectDelete":
      await rejectDelete(interaction);
      break;
    case "signupCwl":
      await signupCwl(interaction);
      break;
  }
};
