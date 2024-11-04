import { EventBridgeEvent } from "aws-lambda";
import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { updateMessage } from "../adapters/discord-adapter";

export const handleComponent = async (
  event: EventBridgeEvent<string, APIMessageComponentInteraction>
) => {
  await updateMessage(event.detail.application_id, event.detail.token, {
    content: "Test update for component message",
  });
};
