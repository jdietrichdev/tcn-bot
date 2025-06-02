import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
import { handleLink } from "../../src/command-handlers/link";
import { verify } from "../../src/adapters/coc-api-adapter";
import { dbClient } from "../../src/clients/dynamodb-client";
import { updateResponse } from "../../src/adapters/discord-adapter";

jest.mock("../../src/adapters/coc-api-adapter");
jest.mock("../../src/clients/dynamodb-client");
jest.mock("../../src/adapters/discord-adapter");

let interaction: APIChatInputApplicationCommandInteraction;

afterEach(jest.resetAllMocks);

describe('link create', () => {
    beforeEach(() => {
        interaction = buildInteraction("create");
    });

    test('should call verify with correct parameters', async () => {
        await handleLink(interaction);
        expect(verify).toHaveBeenCalledWith("#tag", "apiToken");
    });

    test('should update item in dynamo with correct parameters', async () => {
        await handleLink(interaction);
        expect(dbClient.send).toHaveBeenCalledWith(expect.objectContaining({
            input: {
                TableName: "SchedulingTable",
                UpdateExpression: "SET id=:id, tag=:tag",
                Key: {
                    pk: {
                        S: "1234567890"
                    },
                    sk: {
                        S: "player#12345#tag"
                    }
                },
                ExpressionAttributeValues: {
                    ":id": {
                        S: "12345",
                    },
                    ":tag": {
                        S: "#tag"
                    }
                },
                ReturnValues: "NONE"
            }
        }));
    });

    test('should update response when requests are successful', async () => {
        await handleLink(interaction);
        expect(updateResponse).toHaveBeenCalledWith("appId", "token", {
            content: "User successfully linked"
        });
    });

    test('should throw error when a request fails', async () => {
        jest.mocked(verify).mockRejectedValue(new Error("Failed"));
        await expect(handleLink(interaction)).rejects.toThrow(new Error("Failed"));
    });
});

describe('link remove', () => {
    beforeEach(() => {
        interaction = buildInteraction("remove");
    });

    test('should delete item from dynamo with correct parameters', async () => {
        await handleLink(interaction);
        expect(dbClient.send).toHaveBeenCalledWith(expect.objectContaining({
            input: {
                TableName: "SchedulingTable",
                Key: {
                    pk: { S: "1234567890" },
                    sk: { S: 'player#12345#tag' },
                },
            },
        }));
    });

    test('should update response when request is successful', async () => {
        await handleLink(interaction);
        expect(updateResponse).toHaveBeenCalledWith("appId", "token", {
            content: "User successfully unlinked",
        });
    });

    test('should throw error when request fails', async () => {
        jest.mocked(dbClient.send).mockImplementation(() => {
            throw new Error("Failed")
        });
        await expect(handleLink(interaction)).rejects.toThrow(new Error("Failed"));
    });
});

test('should throw error when invalid subcommand', async () => {
    interaction = buildInteraction("invalid");
    await expect(handleLink(interaction)).rejects.toThrow(
        new Error("No processing defined for that command")
    )
})


const buildInteraction = (name: string) => {
    return {
        application_id: "appId",
        token: "token",
        guild_id: "1234567890",
        member: {
            user: {
                id: "12345",
            }
        },
        data: {
            options: [
                {
                    name,
                    options: [
                        {
                            name: "tag",
                            value: "#tag"
                        },
                        {
                            name: "token",
                            value: "apiToken"
                        }
                    ]
                }
            ]
        }
    } as APIChatInputApplicationCommandInteraction;
}