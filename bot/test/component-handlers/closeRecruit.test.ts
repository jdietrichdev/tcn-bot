import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { closeRecruit } from "../../src/component-handlers/closeRecruit"
import { deleteResponse, updateMessage, updateResponse } from "../../src/adapters/discord-adapter";

jest.mock("../../src/adapters/discord-adapter");

let interaction: APIMessageComponentInteraction;

beforeEach(() => {
    interaction = buildInteraction();
})

test('should call updateMessage with correct parameters', async () => {
    await closeRecruit(interaction);
    expect(updateMessage).toHaveBeenCalledWith("channelId", "messageId", {
        content: "Messaged by username\nMessaged by otherUsername",
        components: []
    });
});

test('should call deleteResponse with correct parameters', async () => {
    await closeRecruit(interaction);
    expect(deleteResponse).toHaveBeenCalledWith("appId", "token");
});

test('should call updateResponse when failure occurs', async () => {
    jest.mocked(updateMessage).mockRejectedValue(new Error("Failed"));
    await closeRecruit(interaction);
    expect(updateResponse).toHaveBeenCalledWith("appId", "token", {
        content: "There was an issue closing this recruit message, please try again or contact admins if you continue seeing issues"
    })
})

const buildInteraction = () => {
    return {
        application_id: "appId",
        token: "token",
        channel: { id: "channelId" },
        message: { 
            id: "messageId",
            content: "@Recruiter\nMessaged by username\nMessaged by otherUsername",
        },

    } as APIMessageComponentInteraction;
}