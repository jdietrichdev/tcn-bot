import { APIModalSubmitInteraction } from "discord-api-types/v10";
import { submitApplyModal } from "./apply";
import { submitDenyAppModal } from "./denyApp";

export const submitModal = async (interaction: APIModalSubmitInteraction) => {
  const id = interaction.data.custom_id.split("_")[0];
  switch (id) {
    case "applicationModal":
      await submitApplyModal(interaction);
      break;
    case "denyAppModal":
      await submitDenyAppModal(interaction);
      break;
  }
};
