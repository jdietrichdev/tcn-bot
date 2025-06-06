import { APIGuildTextChannel, APIMessage, APIMessageComponentInteraction, GuildTextChannelType } from "discord-api-types/v10"
import { approveApp } from "../../src/component-handlers/approveApp";
import { ServerConfig } from "../../src/util/serverConfig";
import { createChannel, deleteResponse, pinMessage, sendMessage, updateMessage, updateResponse } from "../../src/adapters/discord-adapter";
import { BUTTONS } from "../../src/component-handlers/buttons";
import { determineRolesButton } from "../../src/component-handlers/utils";

jest.mock('../../src/adapters/discord-adapter');
jest.mock('../../src/component-handlers/utils');

let interaction: APIMessageComponentInteraction;
let config: ServerConfig;

beforeEach(() => {
    interaction = buildInteraction();
    config = {
        APPLICATION_CATEGORY: "applicationCategory",
        RECRUITER_ROLE: "recruiterRole",
        BOT_ID: "botId",
    } as ServerConfig;

    jest.mocked(createChannel).mockResolvedValue(
        { id: "channelId" } as APIGuildTextChannel<GuildTextChannelType>
    );
    jest.mocked(sendMessage).mockResolvedValue({ 
        id: "messageId",
        channel_id: "messageChannelId"
    } as APIMessage);
    jest.mocked(determineRolesButton).mockResolvedValue(BUTTONS.GRANT_ROLES);
});

test('should call createChannel with correct parameters', async () => {
    await approveApp(interaction, config);
    expect(createChannel).toHaveBeenCalledWith({
        name: "\u{1F39F}-username",
        type: 0,
        topic: "Application channel for username:userId",
        parent_id: "applicationCategory",
        permission_overwrites: [
            {
                id: "guildId",
                type: 0,
                allow: "0",
                deny: "1024"
            },
            {
                id: "recruiterRole",
                type: 0,
                allow: "3136",
                deny: "0"
            },
            {
                id: "userId",
                type: 1,
                allow: "3136",
                deny: "0"
            },
            {
                id: "botId",
                type: 1,
                allow: "3136",
                deny: "0"
            }
        ]
    }, "guildId");
});

test('should call sendMessage with correct parameters', async () => {
    await approveApp(interaction, config);
    expect(sendMessage).toHaveBeenCalledWith({
        content: "<@&recruiterRole>\nHey <@userId> thanks for applying! We've attached your original responses below for reference, but feel free to tell us more about yourself!",
        embeds: [{
            title: "Application for username",
            fields: [
                { name: 'field1', value: 'field1' },
                { name: 'field2', value: 'field2' },
                { name: 'field3', value: 'field3' },
                { name: 'field4', value: 'field4' },
                { name: 'field5', value: 'field5' },
            ],
        }],
        components: [{
            type: 1,
            components: [
                BUTTONS.CLOSE_TICKET,
                BUTTONS.DELETE_TICKET,
                BUTTONS.GRANT_ROLES
            ]
        }]
    }, "channelId");
});

test('should call determineRolesButton with correct parameters', async () => {
    await approveApp(interaction, config);
    expect(determineRolesButton).toHaveBeenCalledWith("guildId", "userId", config);
})

test('should call pinMessage with the correct parameters', async () => {
    await approveApp(interaction, config);
    expect(pinMessage).toHaveBeenCalledWith("messageChannelId", "messageId");
});

test('should call updateMessage with correct parameters', async () => {
    await approveApp(interaction, config);
    expect(updateMessage).toHaveBeenCalledWith(
        "interactionChannelId",
        "interactionMessageId",
        {
            content: "Accepted by interactionUserName\n<#channelId>",
            components: []
        }
    );
});

test('should call deleteResponse with correct parameters', async () => {
    await approveApp(interaction, config);
    expect(deleteResponse).toHaveBeenCalledWith("appId", "token");
});

test('should call updateResponse with correct parameters when failure occurs', async () => {
    jest.mocked(sendMessage).mockRejectedValue(new Error("Failed"));
    await approveApp(interaction, config);
    expect(updateResponse).toHaveBeenCalledWith("appId", "token", {
        content: "There was an issue approving this application, if a channel has not been created please try again or reach out to admins"
    })
})

const buildInteraction = () => {
    return {
        guild_id: "guildId",
        application_id: "appId",
        token: "token",
        channel: {
            id: "interactionChannelId",
        },
        message: {
            id: "interactionMessageId",
            embeds: [{
                title: "Application for username",
                fields: [
                    { name: 'field1', value: 'field1' }, 
                    { name: 'field2', value: 'field2' }, 
                    { name: 'field3', value: 'field3' }, 
                    { name: 'field4', value: 'field4' }, 
                    { name: 'field5', value: 'field5' }, 
                    { name: 'userId', value: 'userId' }
                ],
                footer: {
                    text: 'footer'
                }
            }]
        },
        member: {
            user: {
                id: "interactionUserId",
                username: "interactionUserName"
            }
        }
    } as APIMessageComponentInteraction;
}