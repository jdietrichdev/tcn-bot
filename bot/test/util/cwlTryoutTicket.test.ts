import {
  createChannel,
  getChannel,
  getGuildChannels,
  sendMessage,
} from "../../src/adapters/discord-adapter";
import { PermissionFlagsBits } from "discord-api-types/v10";
import { dynamoDbClient } from "../../src/clients/dynamodb-client";
import { canManageCwlDashboard } from "../../src/component-handlers/cwlSignupDashboard";
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
  config: {
    ...config,
    CWL_TRYOUT_STAFF_ROLES: ["titans-admin", "co-leader"],
  },
};

describe("CWL tryout tickets", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows configured CWL ticket staff to manage rosters", () => {
    const pointGuildId = "1310007885656363068";
    const staffRole = "1520202813911859251";
    expect(
      canManageCwlDashboard(pointGuildId, {
        user: { id: "staff" },
        roles: [staffRole],
      } as never)
    ).toBe(true);
    expect(
      canManageCwlDashboard(pointGuildId, {
        user: { id: "member" },
        roles: [],
      } as never)
    ).toBe(false);
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
    const channelPermissionOverwrites = jest.mocked(createChannel).mock.calls[0][0]
      .permission_overwrites;
    if (!channelPermissionOverwrites) {
      throw new Error("Ticket permissions were not configured.");
    }
    for (const roleId of ["titans-admin", "co-leader"]) {
      const overwrite = channelPermissionOverwrites.find(
        (permission) => permission.id === roleId
      );
      const allow = overwrite?.allow;
      if (typeof allow !== "string") {
        throw new Error(`Missing permissions for CWL staff role ${roleId}.`);
      }
      expect(BigInt(allow) & PermissionFlagsBits.ManageChannels)
        .toBe(PermissionFlagsBits.ManageChannels);
      expect(BigInt(allow) & PermissionFlagsBits.ManageMessages)
        .toBe(PermissionFlagsBits.ManageMessages);
    }
    expect(jest.mocked(sendMessage).mock.calls[0][0].content).toContain(
      "<@&titans-admin>"
    );
    expect(jest.mocked(sendMessage).mock.calls[0][0].content).toContain(
      "<@&co-leader>"
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
