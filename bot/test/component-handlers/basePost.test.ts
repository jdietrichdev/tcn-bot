import { APIMessageComponentInteraction } from "discord-api-types/v10";
import {
  addThreadMember,
  updateMessage,
  updateResponse,
} from "../../src/adapters/discord-adapter";
import { dynamoDbClient } from "../../src/clients/dynamodb-client";
import { handleBasePostComponent } from "../../src/component-handlers/basePost";
import {
  BASE_POST_BUTTONS,
  BasePostRecord,
} from "../../src/util/basePost";

jest.mock("../../src/adapters/discord-adapter", () => ({
  addThreadMember: jest.fn(),
  updateMessage: jest.fn(),
  updateResponse: jest.fn(),
}));
jest.mock("../../src/clients/dynamodb-client", () => ({
  dynamoDbClient: { send: jest.fn() },
}));

const basePost: BasePostRecord = {
  guildId: "guild",
  channelId: "channel",
  messageId: "message",
  builderId: "111",
  feedbackThreadId: "555",
  baseId: 1,
  baseLink: "https://link.clashofclans.com/en?action=OpenLayout&id=abc",
  clanCastle: "2x Ice Golem",
  league: "CWL",
  imageUrl: "https://cdn.example/base.png",
  builderName: "Builder",
  downloads: 0,
  positiveVotes: 0,
  negativeVotes: 0,
};

const interaction = {
  application_id: "application",
  token: "interaction-token",
  guild_id: basePost.guildId,
  member: { user: { id: "feedback-user" }, roles: [] },
  message: { id: basePost.messageId },
  data: { custom_id: BASE_POST_BUTTONS.feedback },
} as unknown as APIMessageComponentInteraction;

describe("base-post feedback button", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(dynamoDbClient).send.mockResolvedValue({
      Item: basePost,
    } as never);
  });

  it("adds the clicker to the linked forum thread", async () => {
    await handleBasePostComponent(interaction);

    expect(jest.mocked(addThreadMember)).toHaveBeenCalledWith(
      basePost.feedbackThreadId,
      "feedback-user"
    );
    expect(jest.mocked(updateResponse)).toHaveBeenCalledWith(
      "application",
      "interaction-token",
      {
        content: "You've joined the feedback discussion: <#555>.",
        flags: 64,
      }
    );
    expect(jest.mocked(updateMessage)).not.toHaveBeenCalled();
  });
});
