import { EventBridgeEvent } from "aws-lambda";
import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
import * as commands from "./handlers";
import { handleTest } from "./test";

export const handleCommand = async (
  event: EventBridgeEvent<string, APIChatInputApplicationCommandInteraction>
) => {
  try {
    switch (event.detail.data!.name) {
      case "hello":
        return await commands.handleHello(event.detail);
        break;
      case "player":
        return await commands.handlePlayer(event.detail);
        break;
      case "event":
        return await commands.handleEvent(event.detail);
        break;
      case "link":
        return await commands.handleLink(event.detail);
        break;
      case "test":
        return await handleTest(event.detail);
        break;
      case "upgrade":
        return await commands.handleUpgrade(event.detail);
        break;
      case "ro":
        return await commands.handleRecruit(event.detail);
        break;
      default:
        console.log("Command not found, responding to command");
        return await commands.handleCommandNotFound(event.detail);
    }
  } catch (err) {
    console.error(err);
    await commands.handleFailure(event.detail);
  }
};
