import { APIMessageComponentInteraction } from "discord-api-types/v10"
import { closeTicket } from "../../src/component-handlers/closeTicket";
import { ServerConfig } from "../../src/util/serverConfig";
import { determineRolesButton, isActorRecruiter } from "../../src/component-handlers/utils";
import { deleteResponse, moveChannel, sendMessage, updateChannelPermissions, updateMessage, updateResponse } from "../../src/adapters/discord-adapter";
import { BUTTONS } from "../../src/component-handlers/buttons";

jest.mock("../../src/component-handlers/utils");
jest.mock("../../src/adapters/discord-adapter");

let interaction: APIMessageComponentInteraction;
let config: ServerConfig;

beforeEach(() => {
    interaction = buildInteraction();
    config = {
        ARCHIVE_CATEGORY: "archiveCategory",
    } as ServerConfig;

    jest.mocked(isActorRecruiter).mockResolvedValue(true);
    jest.mocked(determineRolesButton).mockResolvedValue(BUTTONS.REMOVE_ROLES);
});

afterEach(jest.resetAllMocks);

test('should call isActorRecruiter with correct parameters', async () => {
    await closeTicket(interaction, config);
    expect(isActorRecruiter).toHaveBeenCalledWith("guildId", "interactionUserId", config);
});

test('should call moveChannel with correct parameters when actor is recruiter', async () => {
    await closeTicket(interaction, config);
    expect(moveChannel).toHaveBeenCalledWith("interactionChannelId", "archiveCategory");
});

test('should call updateChannelPermissions with correct parameters when actor is recruiter', async () => {
    await closeTicket(interaction, config);
    expect(updateChannelPermissions).toHaveBeenCalledWith(
        "interactionChannelId",
        "applicantId",
        {
            type: 1,
            allow: "0",
            deny: "0"
        }
    );
});

test('should call sendMessage with correct parameters when actor is recruiter', async () => {
    await closeTicket(interaction, config);
    expect(sendMessage).toHaveBeenCalledWith({
        content: "interactionUserName has closed the ticket"
    }, "interactionChannelId");
});

test('should call updateMessage with correct parameters when actor is recruiter', async () => {
    await closeTicket(interaction, config);
    expect(updateMessage).toHaveBeenCalledWith(
        "interactionChannelId",
        "interactionMessageId",
        {
            components: [{
                type: 1,
                components: [
                    BUTTONS.REOPEN_TICKET,
                    BUTTONS.DELETE_TICKET,
                    BUTTONS.REMOVE_ROLES
                ]
            }]
        }
    );
});

test('should call determineRolesButton with correct parameters when actor is recruiter', async () => {
    await closeTicket(interaction, config);
    expect(determineRolesButton).toHaveBeenCalledWith("guildId", "applicantId", config);
});

test('should call sendMessage with correct parameters when actor is not recruiter', async () => {
    jest.mocked(isActorRecruiter).mockResolvedValue(false);
    await closeTicket(interaction, config);
    expect(sendMessage).toHaveBeenCalledWith({
        content: "You do not have permission to close this ticket <@interactionUserId>",
    }, "interactionChannelId");
});

test('should call delete response with correct parameters', async () => {
    await closeTicket(interaction, config);
    expect(deleteResponse).toHaveBeenCalledWith("appId", "token");
});

test('should call updateResponse with correct parameters when failure occurs', async () => {
    jest.mocked(updateChannelPermissions).mockRejectedValue(new Error("Failed"));
    await closeTicket(interaction, config);
    expect(updateResponse).toHaveBeenCalledWith("appId", "token", {
        content: "There was an issue closing this ticket, please try again or reach out to admins"
    })
})

const buildInteraction = () => {
    return {
        guild_id: "guildId",
        application_id: "appId",
        token: "token",
        member: {
            user: {
                id: "interactionUserId",
                username: "interactionUserName"
            }
        },
        message: {
            id: "interactionMessageId",
            channel_id: "interactionChannelId",
        },
        channel: {
            topic: "Application channel for applicantUsername:applicantId",
        }
    } as APIMessageComponentInteraction;
}