import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10"
import { handleCommandNotFound } from "../../src/command-handlers/not-found";
import { updateResponse } from "../../src/adapters/discord-adapter";

jest.mock("../../src/adapters/discord-adapter");

test('handleCommandNotFound should call updateResponse with correct parameters', async () => {
    const interaction = {
        application_id: "appId",
        token: "token"
    } as APIChatInputApplicationCommandInteraction;
    await handleCommandNotFound(interaction);
    expect(updateResponse).toHaveBeenCalledWith("appId", "token", {
        content: "Handling for this function has not yet been defined"
    });
})