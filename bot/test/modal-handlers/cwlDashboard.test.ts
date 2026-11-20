import {
  APIMessageComponentInteraction,
  APIModalSubmitInteraction,
  ComponentType,
  InteractionResponseType,
  TextInputStyle,
} from "discord-api-types/v10";
import { getPlayer } from "../../src/adapters/coc-api-adapter";
import {
  grantRole,
  updateMessage,
  updateResponse,
} from "../../src/adapters/discord-adapter";
import { dynamoDbClient } from "../../src/clients/dynamodb-client";
import { canManageCwlDashboard } from "../../src/component-handlers/cwlSignupDashboard";
import {
  createCwlDashboardModal,
  submitCwlDashboardModal,
} from "../../src/modal-handlers/cwlDashboard";
import { CwlSignupRecord } from "../../src/util/cwlSignup";

jest.mock("../../src/adapters/coc-api-adapter", () => ({
  getPlayer: jest.fn(),
}));
jest.mock("../../src/adapters/discord-adapter", () => ({
  grantRole: jest.fn(),
  updateMessage: jest.fn(),
  updateResponse: jest.fn(),
}));
jest.mock("../../src/clients/dynamodb-client", () => ({
  dynamoDbClient: { send: jest.fn() },
}));
jest.mock("../../src/component-handlers/cwlSignupDashboard", () => ({
  addCwlClanToSignup: jest.fn(),
  canManageCwlDashboard: jest.fn(),
}));
jest.mock("../../src/util/serverConfig", () => ({
  getCwlClanRoleId: jest.fn((config, clan) =>
    config.CWL_CLAN_ROLES?.[clan.tag]
  ),
  getConfig: jest.fn(() => ({
    CWL_CLAN_ROLES: { "2CYP9C9QG": "cwl-role" },
  })),
}));
jest.mock("../../src/util/townHallEmoji", () => ({
  getTownHallEmoji: (
    level: number | undefined,
    emojiIds: Record<string, string>
  ) => {
    if (level === undefined) {
      return { markup: "🏠", componentEmoji: { name: "🏠" } };
    }
    const name = `town_hall_${level}`;
    const id = emojiIds[String(level)];
    return {
      markup: `<:${name}:${id}>`,
      componentEmoji: { id, name },
    };
  },
  loadTownHallEmojiMap: jest.fn(() => ({ "16": "123456789012345678" })),
}));

const createSignup = (): CwlSignupRecord => ({
  pk: "guild",
  sk: "signup#november",
  signupName: "November CWL",
  status: "open",
  channelId: "roster-channel",
  dashboardChannelId: "dashboard-channel",
  dashboardMessageId: "dashboard-message",
  clans: [
    {
      name: "MiniPoint",
      tag: "2CYP9C9QG",
      league: "Master League I",
      link: "https://example.com",
      messageId: "roster-message",
      capacity: 1,
      minTownHall: 18,
      signupOpen: false,
      accounts: [
        {
          userId: "existing-user",
          playerTag: "#EXISTING1",
          playerName: "Existing Player",
          townHallLevel: 18,
        },
      ],
    },
  ],
});

const createInteraction = (
  action: "add_player" | "remove_player",
  tag: string
) =>
  ({
    application_id: "application",
    token: "modal-token",
    guild_id: "guild",
    member: { user: { id: "admin" }, roles: [] },
    data: {
      custom_id: `cwlDashboardModal:${action}:november:2CYP9C9QG`,
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.TextInput,
              custom_id: "player_tag",
              style: TextInputStyle.Short,
              value: tag,
            },
          ],
        },
      ],
    },
  }) as unknown as APIModalSubmitInteraction;

describe("CWL dashboard player management", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(canManageCwlDashboard).mockReturnValue(true);
  });

  it("prefills the linked player tag from a CWL tryout ticket button", async () => {
    jest.mocked(dynamoDbClient).send.mockResolvedValueOnce({
      Item: createSignup(),
    } as never);
    const interaction = {
      guild_id: "guild",
      member: { user: { id: "admin" }, roles: [] },
      data: {
        custom_id:
          "cwl_dashboard_add_player:november:2CYP9C9QG:#PLAYER2",
      },
    } as unknown as APIMessageComponentInteraction;

    const response = await createCwlDashboardModal(interaction);

    if (response.type !== InteractionResponseType.Modal) {
      throw new Error("Expected the add-player modal.");
    }
    expect(response.data.custom_id).toBe(
      "cwlDashboardModal:add_player:november:2CYP9C9QG"
    );
    if (response.data.components?.[0]?.type !== ComponentType.ActionRow) {
      throw new Error("Expected an account tag text input.");
    }
    const playerTagInput = response.data.components[0].components[0];
    expect(playerTagInput.type).toBe(ComponentType.TextInput);
    if (playerTagInput.type !== ComponentType.TextInput) {
      throw new Error("Expected an account tag text input.");
    }
    expect(playerTagInput.value).toBe("#PLAYER2");
  });

  it("lets admins add a linked tag even when normal signup restrictions would block it", async () => {
    const signup = createSignup();
    jest
      .mocked(dynamoDbClient)
      .send.mockResolvedValueOnce({ Item: signup } as never)
      .mockResolvedValueOnce({
        Items: [
          {
            pk: "linked-user",
            sk: "player#PLAYER2",
            tag: "#PLAYER2",
          },
        ],
      } as never)
      .mockResolvedValueOnce({} as never);
    jest.mocked(getPlayer).mockResolvedValueOnce({
      name: "Player Two",
      townHallLevel: 16,
      clan: { name: "Current Clan" },
    } as never);

    await submitCwlDashboardModal(createInteraction("add_player", "#player2"));

    expect(signup.clans[0].accounts).toHaveLength(2);
    expect(signup.clans[0].accounts?.[1]).toMatchObject({
      userId: "linked-user",
      playerTag: "#PLAYER2",
      playerName: "Player Two",
      clanName: "Current Clan",
      townHallLevel: 16,
    });
    expect(jest.mocked(updateMessage)).toHaveBeenCalledTimes(2);
    expect(jest.mocked(grantRole)).toHaveBeenCalledWith(
      "guild",
      "linked-user",
      "cwl-role"
    );
    expect(jest.mocked(updateResponse)).toHaveBeenCalledWith(
      "application",
      "modal-token",
      { content: "Added #PLAYER2 to the **MiniPoint** roster." }
    );
  });

  it("lets admins remove a player by tag without requiring that tag to remain linked", async () => {
    const signup = createSignup();
    jest
      .mocked(dynamoDbClient)
      .send.mockResolvedValueOnce({ Item: signup } as never)
      .mockResolvedValueOnce({} as never);

    await submitCwlDashboardModal(
      createInteraction("remove_player", "existing1")
    );

    expect(signup.clans[0].accounts).toEqual([]);
    expect(jest.mocked(getPlayer)).not.toHaveBeenCalled();
    expect(jest.mocked(updateResponse)).toHaveBeenCalledWith(
      "application",
      "modal-token",
      { content: "Removed #EXISTING1 from the **MiniPoint** roster." }
    );
  });
});
