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
      case "player":
        return await commands.handlePlayer(event.detail);
      case "event":
        return await commands.handleEvent(event.detail);
      case "link":
        return await commands.handleLink(event.detail);
      case "test":
        return await handleTest(event.detail);
      case "upgrade":
        return await commands.handleUpgrade(event.detail);
      case "ro":
        return await commands.handleRecruit(event.detail);
      case "recruiter-score":
        return await commands.handleRecruiterScore(event.detail);
      case "cwl-roster":
        return await commands.handleCwlRoster(event.detail);
      case "initiate-cwl-signup":
        return await commands.handleInitiateCwlSignup(event.detail);
      case "close-ticket":
        return await commands.closeTicket(event.detail);
      default:
        console.log("Command not found, responding to command");
        return await commands.handleCommandNotFound(event.detail);
    }
  } catch (err) {
    console.error(err);
    await commands.handleFailure(event.detail);
  }
};
