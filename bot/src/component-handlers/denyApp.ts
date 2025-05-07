import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { ServerConfig } from "../util/serverConfig";
import {
  deleteResponse,
  sendMessage,
  updateMessage,
  updateResponse,
} from "../adapters/discord-adapter";

export const denyApp = async (
  interaction: APIMessageComponentInteraction,
  config: ServerConfig
) => {};
