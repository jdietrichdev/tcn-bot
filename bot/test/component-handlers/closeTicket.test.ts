import { APIMessageComponentInteraction } from "discord-api-types/v10";
import {
  deleteResponse,
  moveChannel,
  sendMessage,
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
import { deleteTicketChannel, ensureArchiveCapacity } from "../../src/util/ticketDeletion";

jest.mock("../../src/adapters/discord-adapter", () => ({
  deleteResponse: jest.fn(),
  moveChannel: jest.fn(),
  sendMessage: jest.fn(),
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
  deleteTicketChannel: jest.fn(),
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

  it("saves the transcript and deletes a CWL tryout ticket on close", async () => {
    jest.mocked(isActorRecruiter).mockResolvedValue(false);
    jest.mocked(isActorAdmin).mockResolvedValue(false);
    const interaction = {
      application_id: "application",
      token: "interaction-token",
      guild_id: "guild",
      member: {
        user: { id: "staff", username: "Staff" },
        roles: ["cwl-ticket-staff"],
      },
      channel: {
        id: "tryout-channel",
        topic: "CWL tryout for #PLAYER1:discord-user",
      },
      message: { id: "ticket-message", channel_id: "tryout-channel" },
    } as unknown as APIMessageComponentInteraction;
    const config = {
      ARCHIVE_CATEGORY: "",
      CWL_TRYOUT_STAFF_ROLES: ["cwl-ticket-staff"],
      RECRUITER_ROLE: "recruiters",
      ADMIN_ROLE: "admins",
    } as never;

    await closeTicket(interaction, config);

    expect(jest.mocked(deleteTicketChannel)).toHaveBeenCalledWith(
      expect.objectContaining({
        guildId: "guild",
        channelId: "tryout-channel",
        deletedById: "staff",
        deletionReason: "CWL tryout ticket closed.",
      })
    );
    expect(jest.mocked(updateChannelPermissions)).not.toHaveBeenCalled();
    expect(jest.mocked(moveChannel)).not.toHaveBeenCalled();
    expect(jest.mocked(ensureArchiveCapacity)).not.toHaveBeenCalled();
    expect(jest.mocked(deleteResponse)).not.toHaveBeenCalled();
    expect(jest.mocked(sendMessage)).not.toHaveBeenCalled();
    expect(jest.mocked(updateMessage)).not.toHaveBeenCalled();
    expect(jest.mocked(updateResponse)).not.toHaveBeenCalled();
  });

  it("continues to archive non-CWL application tickets", async () => {
    const interaction = {
      application_id: "application",
      token: "interaction-token",
      guild_id: "guild",
      member: { user: { id: "staff", username: "Staff" }, roles: [] },
      channel: { id: "ticket", topic: "Application channel for:applicant" },
      message: { id: "message", channel_id: "ticket" },
    } as unknown as APIMessageComponentInteraction;
    await closeTicket(interaction, { ARCHIVE_CATEGORY: "archive" } as never);
    expect(deleteTicketChannel).not.toHaveBeenCalled();
    expect(moveChannel).toHaveBeenCalledWith("ticket", "archive");
    expect(updateMessage).toHaveBeenCalled();
  });

  it("does not delete a tryout ticket for an unauthorized user", async () => {
    jest.mocked(isActorRecruiter).mockResolvedValue(false);
    jest.mocked(isActorAdmin).mockResolvedValue(false);
    const interaction = {
      application_id: "application",
      token: "interaction-token",
      guild_id: "guild",
      member: { user: { id: "visitor", username: "Visitor" }, roles: [] },
      channel: { id: "ticket", topic: "CWL tryout for #PLAYER1:applicant" },
      message: { id: "message", channel_id: "ticket" },
    } as unknown as APIMessageComponentInteraction;
    await closeTicket(interaction, { CWL_TRYOUT_STAFF_ROLES: ["staff"] } as never);
    expect(deleteTicketChannel).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("do not have permission") }),
      "ticket"
    );
  });

  it("reports deletion failures without archiving the tryout ticket", async () => {
    jest.mocked(deleteTicketChannel).mockRejectedValueOnce(new Error("transcript failed"));
    const consoleError = jest.spyOn(console, "error").mockImplementation();
    const interaction = {
      application_id: "application",
      token: "interaction-token",
      guild_id: "guild",
      member: { user: { id: "staff", username: "Staff" }, roles: [] },
      channel: { id: "ticket", topic: "CWL tryout for #PLAYER1:applicant" },
      message: { id: "message", channel_id: "ticket" },
    } as unknown as APIMessageComponentInteraction;
    await closeTicket(interaction, { ARCHIVE_CATEGORY: "archive" } as never);
    expect(updateResponse).toHaveBeenCalledWith("application", "interaction-token", {
      content: expect.stringContaining("issue closing"),
    });
    expect(moveChannel).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
