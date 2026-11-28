import { APIApplicationCommandInteraction } from "discord-api-types/v10";
import { closeTicket } from "../../src/command-handlers/closeTicket";
import { dynamoDbClient } from "../../src/clients/dynamodb-client";
import { deleteTicketChannel, ensureArchiveCapacity } from "../../src/util/ticketDeletion";
import { isActorAdmin, isActorRecruiter } from "../../src/component-handlers/utils";
import { moveChannel, updateResponse } from "../../src/adapters/discord-adapter";

jest.mock("../../src/clients/dynamodb-client", () => ({
  dynamoDbClient: { send: jest.fn() },
}));
jest.mock("../../src/adapters/discord-adapter", () => ({
  deleteResponse: jest.fn(),
  getChannelMessages: jest.fn(),
  getUser: jest.fn(),
  moveChannel: jest.fn(),
  sendMessage: jest.fn(),
  updateChannelPermissions: jest.fn(),
  updateResponse: jest.fn(),
}));
jest.mock("../../src/component-handlers/utils", () => ({
  isActorAdmin: jest.fn(),
  isActorRecruiter: jest.fn(),
}));
jest.mock("../../src/util/ticketDeletion", () => ({
  deleteTicketChannel: jest.fn(),
  ensureArchiveCapacity: jest.fn(),
}));

test("/close-ticket deletes CWL tryouts for configured tryout staff", async () => {
  jest.mocked(dynamoDbClient).send.mockResolvedValueOnce({
    Item: { tickets: [{ ticketChannel: "ticket" }] },
  } as never);
  const interaction = {
    application_id: "app",
    token: "token",
    guild_id: "1310007885656363068",
    channel: { id: "ticket", topic: "CWL tryout for #PLAYER1:owner" },
    member: {
      user: { id: "staff", username: "Staff" },
      roles: ["1459375267255554130"],
    },
  } as unknown as APIApplicationCommandInteraction;

  await closeTicket(interaction);
  expect(deleteTicketChannel).toHaveBeenCalledWith(expect.objectContaining({
    channelId: "ticket", deletedById: "staff",
  }));
  expect(ensureArchiveCapacity).not.toHaveBeenCalled();
  expect(moveChannel).not.toHaveBeenCalled();
  expect(isActorAdmin).not.toHaveBeenCalled();
  expect(isActorRecruiter).not.toHaveBeenCalled();
  expect(updateResponse).not.toHaveBeenCalled();
});
