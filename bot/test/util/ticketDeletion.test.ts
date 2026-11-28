import { ChannelType, MessageType } from "discord-api-types/v10";
import {
  deleteChannel,
  getChannel,
  getChannelMessages,
  getUser,
  sendMessage,
} from "../../src/adapters/discord-adapter";
import { s3Client } from "../../src/clients/s3-client";
import { dynamoDbClient } from "../../src/clients/dynamodb-client";
import { deleteTicketChannel } from "../../src/util/ticketDeletion";

jest.mock("../../src/adapters/discord-adapter", () => ({
  deleteChannel: jest.fn(),
  getChannel: jest.fn(),
  getChannelMessages: jest.fn(),
  getUser: jest.fn(),
  sendMessage: jest.fn(),
}));
jest.mock("../../src/clients/s3-client", () => ({ s3Client: { send: jest.fn() } }));
jest.mock("../../src/clients/dynamodb-client", () => ({ dynamoDbClient: { send: jest.fn() } }));

const options = {
  guildId: "guild",
  channelId: "ticket",
  config: { BOT_ID: "bot", TRANSCRIPT_CHANNEL: "transcripts" } as never,
  deletedById: "staff",
  deletedByUsername: "Staff",
  deletionReason: "CWL tryout ticket closed.",
};

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(getChannel).mockResolvedValue({
    id: "ticket", type: ChannelType.GuildText, topic: "CWL tryout for #PLAYER1:owner",
  } as never);
  jest.mocked(getChannelMessages).mockResolvedValue([{
    author: { id: "bot", bot: true },
    content: "An unrelated bot message",
    embeds: [],
    type: MessageType.Default,
    timestamp: "2026-01-01T00:00:00Z",
  }] as never);
  jest.mocked(getUser).mockResolvedValue({ username: "Player" } as never);
  jest.mocked(dynamoDbClient).send.mockResolvedValue({ Item: { tickets: [] } } as never);
});

test("saves a valid transcript before deleting a tryout channel", async () => {
  await deleteTicketChannel(options);
  expect(s3Client.send).toHaveBeenCalled();
  expect(sendMessage).toHaveBeenCalledWith({
    embeds: [expect.objectContaining({
      title: "CWL tryout for Player",
      fields: expect.arrayContaining([
        expect.objectContaining({ name: "Participants", value: "No non-bot participants." }),
      ]),
    })],
    components: expect.any(Array),
  }, "transcripts");
  const transcript = jest.mocked(sendMessage).mock.calls[0][0].embeds?.[0];
  expect(transcript?.fields?.every((field) => field.name && field.value)).toBe(true);
  expect(deleteChannel).toHaveBeenCalledWith("ticket");
  expect(jest.mocked(sendMessage).mock.invocationCallOrder[0])
    .toBeLessThan(jest.mocked(deleteChannel).mock.invocationCallOrder[0]);
});

test("does not delete a channel if transcript storage fails", async () => {
  jest.mocked(s3Client).send.mockRejectedValueOnce(new Error("storage failed") as never);
  await expect(deleteTicketChannel(options)).rejects.toThrow("storage failed");
  expect(deleteChannel).not.toHaveBeenCalled();
  expect(sendMessage).not.toHaveBeenCalled();
});
