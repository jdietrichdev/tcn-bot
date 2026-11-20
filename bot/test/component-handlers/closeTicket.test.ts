import { APIMessageComponentInteraction } from "discord-api-types/v10";
import {
  deleteResponse,
  moveChannel,
  sendMessage,
  updateChannel,
  updateChannelPermissions,
  updateMessage,
  updateResponse,
} from "../../src/adapters/discord-adapter";
import { closeTicket } from "../../src/component-handlers/closeTicket";
import {
  determineRolesButton,
  isActorAdmin,
  isActorRecruiter,
} from "../../src/component-handlers/utils";
import { ensureArchiveCapacity } from "../../src/util/ticketDeletion";

jest.mock("../../src/adapters/discord-adapter", () => ({
  deleteResponse: jest.fn(),
  moveChannel: jest.fn(),
  sendMessage: jest.fn(),
  updateChannel: jest.fn(),
  updateChannelPermissions: jest.fn(),
  updateMessage: jest.fn(),
  updateResponse: jest.fn(),
}));
jest.mock("../../src/component-handlers/utils", () => ({
  determineRolesButton: jest.fn(),
  isActorAdmin: jest.fn(),
  isActorRecruiter: jest.fn(),
}));
jest.mock("../../src/util/ticketDeletion", () => ({
  ensureArchiveCapacity: jest.fn(),
}));

describe("CWL tryout ticket close button", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(isActorRecruiter).mockResolvedValue(true);
    jest.mocked(isActorAdmin).mockResolvedValue(false);
    jest.mocked(determineRolesButton).mockResolvedValue({
      type: 2,
      style: 2,
      label: "Roles",
      custom_id: "roles",
    } as never);
  });

  it("closes a Point CWL tryout ticket without requiring an archive category", async () => {
    const interaction = {
      application_id: "application",
      token: "interaction-token",
      guild_id: "guild",
      member: { user: { id: "staff", username: "Staff" }, roles: [] },
      channel: {
        id: "tryout-channel",
        topic: "CWL tryout for #PLAYER1:discord-user",
      },
      message: { id: "ticket-message", channel_id: "tryout-channel" },
    } as unknown as APIMessageComponentInteraction;
    const config = {
      ARCHIVE_CATEGORY: "",
      RECRUITER_ROLE: "recruiters",
      ADMIN_ROLE: "admins",
    } as never;

    await closeTicket(interaction, config);

    expect(jest.mocked(updateChannel)).toHaveBeenCalledWith(
      { topic: "Closed CWL tryout for #PLAYER1:discord-user" },
      "tryout-channel"
    );
    expect(jest.mocked(updateChannelPermissions)).toHaveBeenCalledWith(
      "tryout-channel",
      "discord-user",
      expect.objectContaining({ type: 1 })
    );
    expect(jest.mocked(moveChannel)).not.toHaveBeenCalled();
    expect(jest.mocked(ensureArchiveCapacity)).not.toHaveBeenCalled();
    expect(jest.mocked(deleteResponse)).toHaveBeenCalledWith(
      "application",
      "interaction-token"
    );
    expect(jest.mocked(sendMessage)).toHaveBeenCalled();
    expect(jest.mocked(updateMessage)).toHaveBeenCalled();
    expect(jest.mocked(updateResponse)).not.toHaveBeenCalled();
  });
});
