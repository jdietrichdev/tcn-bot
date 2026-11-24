import { APIMessageComponentInteraction, ChannelType } from "discord-api-types/v10";
import { getChannel, sendMessage, updateResponse } from "../../src/adapters/discord-adapter";
import { notifyCwlTryoutStaff } from "../../src/component-handlers/cwlTryoutReady";

jest.mock("../../src/adapters/discord-adapter", () => ({
  getChannel: jest.fn(),
  sendMessage: jest.fn(),
  updateResponse: jest.fn(),
}));

const interaction = (userId: string) => ({
  application_id: "app",
  token: "token",
  guild_id: "1310007885656363068",
  channel: { id: "ticket" },
  member: { user: { id: userId }, roles: [] },
} as unknown as APIMessageComponentInteraction);

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(getChannel).mockResolvedValue({
    type: ChannelType.GuildText,
    topic: "CWL tryout for #PLAYER1:owner",
  } as never);
});

test("the assigned player can post a readiness embed that pings configured staff", async () => {
  await notifyCwlTryoutStaff(interaction("owner"));
  expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
    content: "<@&1520202813911859251> <@&1459375267255554130>",
    allowed_mentions: { parse: [], roles: ["1520202813911859251", "1459375267255554130"] },
    embeds: [expect.objectContaining({
      title: "Ready for a CWL Tryout",
      description: expect.stringContaining("#PLAYER1"),
    })],
  }), "ticket");
  expect(updateResponse).toHaveBeenCalledWith("app", "token", {
    content: "CWL tryout staff have been notified.",
  });
});

test.each(["another-user", "staff"])("does not allow %s to notify on behalf of the owner", async (user) => {
  await notifyCwlTryoutStaff(interaction(user));
  expect(sendMessage).not.toHaveBeenCalled();
  expect(updateResponse).toHaveBeenCalledWith("app", "token", {
    content: expect.stringContaining("Only the player assigned"),
  });
});

test("does not notify staff from a closed ticket", async () => {
  jest.mocked(getChannel).mockResolvedValueOnce({
    type: ChannelType.GuildText,
    topic: "Closed CWL tryout for #PLAYER1:owner",
  } as never);
  await notifyCwlTryoutStaff(interaction("owner"));
  expect(sendMessage).not.toHaveBeenCalled();
});

test("reports missing staff configuration without posting", async () => {
  const testInteraction = interaction("owner");
  testInteraction.guild_id = "1021786969077973022";
  await notifyCwlTryoutStaff(testInteraction);
  expect(sendMessage).not.toHaveBeenCalled();
  expect(updateResponse).toHaveBeenCalledWith("app", "token", {
    content: expect.stringContaining("staff roles are not configured"),
  });
});
