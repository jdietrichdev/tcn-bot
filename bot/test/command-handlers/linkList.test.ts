import {
  APIChatInputApplicationCommandInteraction,
  APIMessageComponentInteraction,
  ComponentType,
} from "discord-api-types/v10";
import { getClan } from "../../src/adapters/coc-api-adapter";
import { updateResponse } from "../../src/adapters/discord-adapter";
import { dynamoDbClient } from "../../src/clients/dynamodb-client";
import { handleLinkList, handleLinkListSelect } from "../../src/command-handlers/linkList";

jest.mock("../../src/adapters/coc-api-adapter", () => ({ getClan: jest.fn() }));
jest.mock("../../src/adapters/discord-adapter", () => ({ updateResponse: jest.fn() }));
jest.mock("../../src/clients/dynamodb-client", () => ({
  dynamoDbClient: { send: jest.fn() },
}));

const command = {
  application_id: "app",
  token: "token",
  guild_id: "1310007885656363068",
} as APIChatInputApplicationCommandInteraction;

const select = {
  ...command,
  data: {
    custom_id: "link_list_clan",
    component_type: ComponentType.StringSelect,
    values: ["#2J9QJ9YVJ"],
  },
} as unknown as APIMessageComponentInteraction;

describe("link list", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("shows linked and unlinked clan members and configured clans", async () => {
    jest.mocked(getClan).mockResolvedValue({
      memberList: [{ name: "Linked", tag: "#AAA" }, { name: "Unlinked", tag: "#BBB" }],
    });
    jest.mocked(dynamoDbClient.send)
      .mockResolvedValueOnce({ Items: [{ pk: "12345", sk: "player#aaa" }] } as never);

    await handleLinkList(command);

    expect(getClan).toHaveBeenCalledWith("#2CYP9C9QG");
    const payload = jest.mocked(updateResponse).mock.calls[0][2];
    expect(payload.embeds?.[0].description).toContain("**Linked to the bot: 1**");
    expect(payload.embeds?.[0].description).toContain("Linked (`#AAA`) — <@12345>");
    expect(payload.embeds?.[0].description).toContain("**Not linked: 1**");
    expect(payload.embeds?.[0].description).toContain("Unlinked (`#BBB`)");
    expect(payload.allowed_mentions).toEqual({ parse: [] });
    expect(JSON.stringify(payload.components)).toContain("#2J9QJ9YVJ");
  });

  it("loads the selected clan and follows scan pagination", async () => {
    jest.mocked(getClan).mockResolvedValue({ memberList: [{ name: "Player", tag: "#ABC" }] });
    jest.mocked(dynamoDbClient.send)
      .mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { pk: "1", sk: "player#ABC" } } as never)
      .mockResolvedValueOnce({ Items: [{ pk: "222", sk: "player#ABC" }] } as never);

    await handleLinkListSelect(select);

    expect(getClan).toHaveBeenCalledWith("#2J9QJ9YVJ");
    expect(jest.mocked(dynamoDbClient.send).mock.calls[1][0].input)
      .toEqual(expect.objectContaining({ ExclusiveStartKey: { pk: "1", sk: "player#ABC" } }));
    expect(jest.mocked(updateResponse).mock.calls[0][2].embeds?.[0].description)
      .toContain("<@222>");
  });

  it("uses the Point clans in the test server", async () => {
    jest.mocked(getClan).mockResolvedValue({ memberList: [] });
    await handleLinkList({ ...command, guild_id: "1021786969077973022" });
    expect(getClan).toHaveBeenCalledWith("#2CYP9C9QG");
    const components = JSON.stringify(jest.mocked(updateResponse).mock.calls[0][2].components);
    for (const tag of ["#2CYP9C9QG", "#2CLL8UJR2", "#2G2RJQ2UG", "#2J9QJ9YVJ"]) {
      expect(components).toContain(tag);
    }

    await handleLinkListSelect({ ...select, guild_id: "1021786969077973022" });
    expect(getClan).toHaveBeenLastCalledWith("#2J9QJ9YVJ");
  });

  it("keeps a full clan within Discord embed limits", async () => {
    jest.mocked(getClan).mockResolvedValue({
      memberList: Array.from({ length: 50 }, (_, index) => ({
        name: "*".repeat(24),
        tag: `#${index.toString().padStart(15, "0")}`,
      })),
    });
    jest.mocked(dynamoDbClient.send).mockResolvedValue({
      Items: Array.from({ length: 50 }, (_, index) => ({
        pk: "12345678901234567890",
        sk: `player#${index.toString().padStart(15, "0")}`,
      })),
    } as never);

    await handleLinkList(command);
    const embeds = jest.mocked(updateResponse).mock.calls[0][2].embeds!;
    expect(embeds.every((embed) => (embed.description?.length ?? 0) <= 4096)).toBe(true);
    expect(embeds.reduce((sum, embed) => sum + (embed.description?.length ?? 0) + (embed.title?.length ?? 0), 0)).toBeLessThanOrEqual(6000);
    expect(embeds.map((embed) => embed.description).join("\n").match(/✅/g)).toHaveLength(50);
  });

  it("reports failed selections rather than presenting incomplete results", async () => {
    jest.mocked(getClan).mockRejectedValue(new Error("Clash API unavailable"));
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    await handleLinkListSelect(select);
    expect(updateResponse).toHaveBeenCalledWith("app", "token", expect.objectContaining({
      content: "Could not update the link list. Please try again.",
    }));
    log.mockRestore();
  });

  it("rejects a clan that is not configured for the server", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    await handleLinkListSelect({
      ...select,
      data: { ...select.data, component_type: ComponentType.StringSelect, values: ["#OTHER"] },
    } as APIMessageComponentInteraction);
    expect(getClan).not.toHaveBeenCalled();
    expect(updateResponse).toHaveBeenCalledWith("app", "token", expect.objectContaining({
      content: "Could not update the link list. Please try again.",
    }));
    log.mockRestore();
  });
});
