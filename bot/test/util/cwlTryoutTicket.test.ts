import {
  createChannel,
  getChannel,
  getGuildChannels,
  sendMessage,
} from "../../src/adapters/discord-adapter";
import { dynamoDbClient } from "../../src/clients/dynamodb-client";
import { createCwlTryoutTicket } from "../../src/util/cwlTryoutTicket";
import { getConfig } from "../../src/util/serverConfig";

jest.mock("../../src/adapters/discord-adapter", () => ({
  createChannel: jest.fn(),
  getChannel: jest.fn(),
  getGuildChannels: jest.fn(),
  sendMessage: jest.fn(),
}));
jest.mock("../../src/clients/dynamodb-client", () => ({
  dynamoDbClient: { send: jest.fn() },
}));

const config = getConfig("1021786969077973022");
const input = {
  guildId: "1021786969077973022",
  userId: "discord-user",
  username: "Player One",
  playerTag: "#PLAYER1",
  targetClan: "AlphaPoint",
  signupId: "november",
  clanTag: "2CLL8UJR2",
  targetLeague: "Champion League I",
  previousLeague: "Champion League II",
  averageStars: 2.7,
  reason: "A ticket is required before moving up.",
  categoryId: "tryout-category",
  config,
};

describe("CWL tryout tickets", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a private ticket, posts review details, and registers it with ticket commands", async () => {
    jest
      .mocked(dynamoDbClient)
      .send.mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({
        Item: {
          pk: input.guildId,
          sk: "tickets",
          tickets: [],
        },
      } as never)
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({} as never);
    jest.mocked(createChannel).mockResolvedValueOnce({
      id: "ticket-channel",
    } as never);

    await expect(createCwlTryoutTicket(input)).resolves.toEqual({
      channelId: "ticket-channel",
      created: true,
    });

    expect(jest.mocked(createChannel)).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "cwl-champion-league-i-playerone-ayer1-user",
        parent_id: "tryout-category",
        permission_overwrites: expect.arrayContaining([
          expect.objectContaining({
            id: input.userId,
            type: 1,
          }),
        ]),
      }),
      input.guildId
    );
    expect(jest.mocked(sendMessage)).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [
          expect.objectContaining({
            title: "CWL Tryout Request",
            fields: expect.arrayContaining([
              expect.objectContaining({
                name: "Player",
                value: "#PLAYER1",
              }),
            ]),
          }),
        ],
        components: [
          expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({ custom_id: "closeTicket" }),
              expect.objectContaining({
                label: "Signup Player for Roster",
                custom_id:
                  "cwl_dashboard_add_player:november:2CLL8UJR2:#PLAYER1",
              }),
            ]),
          }),
        ],
      }),
      "ticket-channel"
    );
    expect(jest.mocked(dynamoDbClient).send).toHaveBeenCalledTimes(5);
  });

  it("reuses an open ticket in the configured category", async () => {
    jest.mocked(dynamoDbClient).send.mockResolvedValueOnce({
      Item: { channelId: "existing-ticket" },
    } as never);
    jest.mocked(getGuildChannels).mockResolvedValueOnce([
      { id: "existing-ticket", parent_id: "tryout-category" },
    ] as never);
    jest.mocked(getChannel).mockResolvedValueOnce({
      id: "existing-ticket",
      type: 0,
      parent_id: "tryout-category",
      topic: "CWL tryout for #PLAYER1:discord-user",
    } as never);

    await expect(createCwlTryoutTicket(input)).resolves.toEqual({
      channelId: "existing-ticket",
      created: false,
    });
    expect(jest.mocked(createChannel)).not.toHaveBeenCalled();
    expect(jest.mocked(sendMessage)).not.toHaveBeenCalled();
  });

  it("does not reuse another linked account's existing ticket", async () => {
    jest
      .mocked(dynamoDbClient)
      .send.mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({
        Item: { channelId: "player-one-ticket" },
      } as never)
      .mockResolvedValueOnce({
        Item: {
          pk: input.guildId,
          sk: "tickets",
          tickets: [
            {
              ticketChannel: "player-one-ticket",
              userId: input.userId,
              playerTag: "#PLAYER1",
              type: "cwl-tryout",
            },
          ],
        },
      } as never)
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({} as never);
    jest.mocked(getGuildChannels).mockResolvedValueOnce([
      { id: "player-one-ticket", parent_id: "tryout-category" },
    ] as never);
    jest.mocked(getChannel).mockResolvedValueOnce({
      id: "player-one-ticket",
      type: 0,
      parent_id: "tryout-category",
      topic: "CWL tryout for #PLAYER1:discord-user",
    } as never);
    jest.mocked(createChannel).mockResolvedValueOnce({
      id: "player-two-ticket",
    } as never);

    await expect(
      createCwlTryoutTicket({ ...input, playerTag: "#PLAYER2" })
    ).resolves.toEqual({
      channelId: "player-two-ticket",
      created: true,
    });
    expect(jest.mocked(createChannel)).toHaveBeenCalledTimes(1);
    expect(jest.mocked(sendMessage)).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                name: "Player",
                value: "#PLAYER2",
              }),
            ]),
          }),
        ],
      }),
      "player-two-ticket"
    );
  });
});
