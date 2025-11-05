import { APIApplicationCommandAutocompleteInteraction } from "discord-api-types/v10";
import * as autocomplete from "./handlers";

export const handleAutocomplete = async (
  interaction: APIApplicationCommandAutocompleteInteraction
) => {
  try {
    switch (interaction.data.name) {
      case "upgrade":
        return await autocomplete.handleUpgrade(interaction);
      case "cwl-roster":
        return await autocomplete.handleCwlRoster(interaction);
      case "link":
        return await autocomplete.handleLink(interaction);
      case "nomination-result":
        return await autocomplete.handleNominationResult(interaction);
      case "question-close":
        return await autocomplete.handleQuestionClose(interaction);
      case "question-answer":
        return await autocomplete.handleQuestionAnswer(interaction);
      case "roster-add":
        return await autocomplete.handleRosterAdd(interaction);
      case "roster-show":
        return await autocomplete.handleRosterShow(interaction);
      case "roster-remove":
        return await autocomplete.handleRosterRemove(interaction);
      case "roster-delete":
        return await autocomplete.handleRosterDelete(interaction);
      case "cwl-response":
        return await autocomplete.handleCwlResponse(interaction);
      case "task-claim":
        return await autocomplete.handleTaskClaim(interaction);
      case "task-complete":
        return await autocomplete.handleTaskComplete(interaction);
      case "task-approve":
        return await autocomplete.handleTaskApprove(interaction);
      case "task-unclaim":
        return await autocomplete.handleTaskUnclaim(interaction);
      case "task-delete":
        return await autocomplete.handleTaskDelete(interaction);
      case "task-notify":
        return await autocomplete.handleTaskNotify(interaction);
      default:
        console.log("Autocomplete not found, no response needed");
        throw new Error("No autocomplete process defined");
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
};
