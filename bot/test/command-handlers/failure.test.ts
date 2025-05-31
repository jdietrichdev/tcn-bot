import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
import { handleFailure } from "../../src/command-handlers/failure";
import { updateResponse } from "../../src/adapters/discord-adapter";

jest.mock("../../src/adapters/discord-adapter");

test('handleFailure should call updateResponse with correct parameters', async () => {
    await handleFailure({ application_id: "appId", token: "token" } as APIChatInputApplicationCommandInteraction);
    expect(updateResponse).toHaveBeenCalledWith("appId", "token", {
        content: "Processing of this command failed, please try again"
    });
});