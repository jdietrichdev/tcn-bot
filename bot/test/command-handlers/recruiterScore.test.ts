import { APIChatInputApplicationCommandInteraction, APIEmbed, APIMessage, APIUser } from "discord-api-types/v10";
import { handleRecruiterScore } from "../../src/command-handlers/recruiterScore"
import { getConfig, ServerConfig } from "../../src/util/serverConfig";
import { getChannelMessages, getMessageReaction, sendMessage, updateResponse } from "../../src/adapters/discord-adapter";

jest.mock("../../src/util/serverConfig");
jest.mock("../../src/adapters/discord-adapter");
jest.useFakeTimers();
jest.setSystemTime(new Date('2020-10-10'));

let defaultEmbed: APIEmbed;
let interaction: APIChatInputApplicationCommandInteraction;

beforeEach(() => {
    jest.mocked(getConfig).mockReturnValue({
        RECRUITMENT_OPP_CHANNEL: "recruitmentOppChannel",
        RECRUITER_CHANNEL: "recruiterChannel",
    } as ServerConfig);
    jest.mocked(getChannelMessages).mockResolvedValue([]);
    jest.mocked(getMessageReaction).mockResolvedValue([])

    defaultEmbed = {
        title: "Recruiter Scoring for Last Week",
        description: "Scores based on participation in <#recruitmentOppChannel>",
        fields: [],
        footer: { text: "Who will be on top next week?" },
    };
    interaction = buildInteraction();
});

afterEach(jest.resetAllMocks);

test('should call getConfig with input when string', async () => {
    await handleRecruiterScore("id");
    expect(getConfig).toHaveBeenCalledWith("id");
});

test('should call getConfig with guildId when interaction', async () => {
    await handleRecruiterScore(interaction);
    expect(getConfig).toHaveBeenCalledWith("guildId");
});

test('should call getChannelMessages with correct parameters', async () => {
    await handleRecruiterScore(interaction);
    expect(getChannelMessages).toHaveBeenCalledWith("recruitmentOppChannel", new Date("2020-10-03"));
});

test('should not count bump command when on cooldown', async () => {
    const cooldownMessage = {
        type: 20,
        embeds: [{ title: "You're on Cooldown" }]
    } as APIMessage;
    jest.mocked(getChannelMessages).mockResolvedValue([cooldownMessage]);
    await handleRecruiterScore(interaction);
    expect(sendMessage).toHaveBeenCalledWith({ embeds: [defaultEmbed] }, "recruiterChannel");
});

test('should count bump command when not on cooldown', async () => {
    const bumpMessage = {
        type: 20,
        embeds: [{ title: "Your Clan is Bumped!"}],
        interaction_metadata: {
            user: {
                username: 'user'
            }
        }
    } as APIMessage;
    jest.mocked(getChannelMessages).mockResolvedValue([bumpMessage]);
    await handleRecruiterScore(interaction);
    defaultEmbed.fields = [{
        name: "**user**",
        value: "Bumps: 1\nForwards: 0\nReach Outs: 0\n**Score**: 5"
    }]
    expect(sendMessage).toHaveBeenCalledWith({ embeds: [defaultEmbed] }, "recruiterChannel");
});

test('should not count regular message', async () => {
    const standardMessage = {
        type: 0,
        content: "Test"
    } as APIMessage;
    jest.mocked(getChannelMessages).mockResolvedValue([standardMessage]);
    await handleRecruiterScore(interaction);
    expect(sendMessage).toHaveBeenCalledWith({ embeds: [defaultEmbed] }, "recruiterChannel");
});

test('should count forwarded messages as a forward and reach out', async () => {
    const forwardedMessage = {
        type: 0,
        message_reference: {},
        author: { username: "user" }
    } as APIMessage;
    jest.mocked(getChannelMessages).mockResolvedValue([forwardedMessage]);
    await handleRecruiterScore(interaction);
    defaultEmbed.fields = [{
        name: "**user**",
        value: "Bumps: 0\nForwards: 1\nReach Outs: 1\n**Score**: 2"
    }]
    expect(sendMessage).toHaveBeenCalledWith({ embeds: [defaultEmbed] }, "recruiterChannel")
});

test('should not count additional reach out if forwarder also reacts', async () => {
    const reactionMessage = {
        type: 0,
        message_reference: {},
        author: { username: "user" },
        reactions: [{ emoji: { name: "✉️" }}]
    } as APIMessage
    jest.mocked(getChannelMessages).mockResolvedValue([reactionMessage]);
    jest.mocked(getMessageReaction).mockResolvedValue([{ username: "user" } as APIUser]);
    await handleRecruiterScore(interaction);
    defaultEmbed.fields = [{
        name: "**user**",
        value: "Bumps: 0\nForwards: 1\nReach Outs: 1\n**Score**: 2"
    }]
    expect(sendMessage).toHaveBeenCalledWith({ embeds: [defaultEmbed] }, "recruiterChannel")
});

test('should not count OTTO reactions towards score', async () => {
    const reactionMessage = {
        type: 0,
        message_reference: {},
        author: { username: "user" },
        reactions: [{ emoji: { name: "✉️" }}]
    } as APIMessage
    jest.mocked(getChannelMessages).mockResolvedValue([reactionMessage]);
    jest.mocked(getMessageReaction).mockResolvedValue([{ username: "O.T.T.O" } as APIUser]);
    await handleRecruiterScore(interaction);
    defaultEmbed.fields = [{
        name: "**user**",
        value: "Bumps: 0\nForwards: 1\nReach Outs: 1\n**Score**: 2"
    }]
    expect(sendMessage).toHaveBeenCalledWith({ embeds: [defaultEmbed] }, "recruiterChannel")
});

test('should compile multiple users scores and send to channel', async () => {
    const reactionMessage = {
        type: 0,
        message_reference: {},
        author: { username: "user" },
        reactions: [{ emoji: { name: "✉️" }}]
    } as APIMessage
    jest.mocked(getChannelMessages).mockResolvedValue([reactionMessage]);
    jest.mocked(getMessageReaction).mockResolvedValue([{ username: "otherUser" } as APIUser]);
    await handleRecruiterScore(interaction);
    defaultEmbed.fields = [
        {
            name: "**user**",
            value: "Bumps: 0\nForwards: 1\nReach Outs: 1\n**Score**: 2"
        },
        {
            name: "**otherUser**",
            value: "Bumps: 0\nForwards: 0\nReach Outs: 1\n**Score**: 1"
        }
    ]
    expect(sendMessage).toHaveBeenCalledWith({ embeds: [defaultEmbed] }, "recruiterChannel")
});

test('should not call updateResponse when input is string', async () => {
    await handleRecruiterScore("id");
    expect(updateResponse).not.toHaveBeenCalled();
});

test('should call updateResponse with correct parameters when input is an interaction', async () => {
    await handleRecruiterScore(interaction);
    expect(updateResponse).toHaveBeenCalledWith("appId", "token", {
        content: "Information has been compiled and sent to <#recruiterChannel>",
    });
});

test('should throw error when failure occurs and input is string', async () => {
    jest.mocked(getChannelMessages).mockRejectedValue(new Error("Failed"));
    await expect(handleRecruiterScore("id")).rejects.toThrow(new Error("Failure generating recruitment score"));
})

test('should call updateResponse when failure occurs and input is interaction', async () => {
    jest.mocked(getChannelMessages).mockRejectedValue(new Error("Failed"));
    await handleRecruiterScore(interaction);
    expect(updateResponse).toHaveBeenCalledWith("appId", "token", {
        content: "There was a failure generating the recruitment score, please try again or contact admins for assistance",
    });
});



const buildInteraction = () => {
    return {
        guild_id: "guildId",
        application_id: "appId",
        token: "token",
    } as APIChatInputApplicationCommandInteraction
}