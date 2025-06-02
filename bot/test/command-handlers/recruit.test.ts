import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
import { handleRecruit } from "../../src/command-handlers/recruit";
import { getConfig, ServerConfig } from "../../src/util/serverConfig"
import { sendMessage, updateResponse } from "../../src/adapters/discord-adapter";
import { BUTTONS } from "../../src/component-handlers/buttons";

let interaction: APIChatInputApplicationCommandInteraction;

jest.mock("../../src/util/serverConfig");
jest.mock("../../src/adapters/discord-adapter");

beforeEach(() => {
    jest.mocked(getConfig).mockReturnValue({
        RECRUITER_ROLE: "recruiterRole",
        RECRUITMENT_OPP_CHANNEL: "recruitmentChannel",
    } as ServerConfig);
    
    interaction = buildInteraction();
});

afterEach(jest.resetAllMocks);

test('handleRecruit should getConfig with guild ID', async () => {
    await handleRecruit(interaction);
    expect(getConfig).toHaveBeenCalledWith("1234567890");
});

test('handleRecruit should send message with correct content', async () => {
    await handleRecruit(interaction);
    expect(sendMessage).toHaveBeenCalledWith({
        content: '<@&recruiterRole>',
        embeds: [{
            title: "New potential recruit!",
            description: "user recommends <@0987654321>\nNotes: note",
        }],
        components: [{
            type: 1,
            components: [BUTTONS.MESSAGE_RECRUIT, BUTTONS.CLOSE_RECRUIT]
        }],
        allowed_mentions: {
            parse: ["roles"],
            users: ["0987654321"]
        }
    }, "recruitmentChannel");
});

test('handleRecruit should update response when request is successful', async () => {
    await handleRecruit(interaction);
    expect(updateResponse).toHaveBeenCalledWith("appId", "token", {
        content: "Thanks for your recommendation <@userId>",
    });
});

test('handleRecruit should update response when request fails', async () => {
    jest.mocked(sendMessage).mockRejectedValue(new Error("Failed"));
    await handleRecruit(interaction);
    expect(updateResponse).toHaveBeenCalledWith("appId", "token", {
        content: "Your request may have failed, if you do not see a message in the expected channel please try again",
    })
});

const buildInteraction = () => {
    return {
        guild_id: "1234567890",
        application_id: "appId",
        token: "token",
        data: {
            options: [
                { name: "user", value: "0987654321" },
                { name: "notes", value: "note" },
            ],
        },
        member: {
            user: {
                username: "user",
                id: "userId",
            }
        }
    } as APIChatInputApplicationCommandInteraction;
}