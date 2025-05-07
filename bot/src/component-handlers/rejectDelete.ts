import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { deleteResponse } from "../adapters/discord-adapter";

export const rejectDelete = async (
  interaction: APIMessageComponentInteraction
) => {
  await deleteResponse(interaction.application_id, interaction.token);
};
