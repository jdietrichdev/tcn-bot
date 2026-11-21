import { DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const { backfill }: {
  backfill: (client: { send: jest.Mock }, pause: jest.Mock) => Promise<void>;
} = require("../../scripts/backfill-link-index.cjs");

describe("player link index backfill", () => {
  const active = {
    Table: { GlobalSecondaryIndexes: [
      { IndexName: "normalized-player-tag-index", IndexStatus: "ACTIVE" },
    ] },
  };
  let send: jest.Mock;
  let pause: jest.Mock;

  beforeEach(() => {
    send = jest.fn();
    pause = jest.fn().mockResolvedValue(undefined);
  });

  it("backfills mixed-case links across pages and marks completion", async () => {
    send
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        Items: [{ pk: "123", sk: "player#aBc" }],
        LastEvaluatedKey: { pk: "123", sk: "player#aBc" },
        ConsumedCapacity: { CapacityUnits: 1 },
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        Items: [{ pk: "456", sk: "player#XYZ", normalizedPlayerTag: "player#XYZ" }],
      })
      .mockResolvedValueOnce({});

    await backfill({ send }, pause);

    expect(send.mock.calls[0][0]).toBeInstanceOf(DescribeTableCommand);
    expect(send.mock.calls[1][0]).toBeInstanceOf(PutCommand);
    expect(send.mock.calls[2][0]).toBeInstanceOf(ScanCommand);
    expect(send.mock.calls[3][0]).toBeInstanceOf(UpdateCommand);
    expect(send.mock.calls[3][0].input).toEqual(expect.objectContaining({
      Key: { pk: "123", sk: "player#aBc" },
      ConditionExpression: "attribute_exists(pk)",
      ExpressionAttributeValues: { ":tag": "player#ABC" },
    }));
    expect(send.mock.calls[4][0].input.ExclusiveStartKey)
      .toEqual({ pk: "123", sk: "player#aBc" });
    expect(send.mock.calls[5][0].input.Item.status).toBe("complete");
    expect(pause).toHaveBeenCalledWith(1000);
  });

  it("does not mark an interrupted migration complete", async () => {
    send.mockResolvedValueOnce(active).mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("scan failed"));
    await expect(backfill({ send }, pause)).rejects.toThrow("scan failed");
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls[1][0].input.Item.status).toBe("in-progress");
  });

  it("does not recreate a link deleted while scanning", async () => {
    const deleted = new Error("deleted");
    deleted.name = "ConditionalCheckFailedException";
    send.mockResolvedValueOnce(active).mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Items: [{ pk: "123", sk: "player#abc" }] })
      .mockRejectedValueOnce(deleted)
      .mockResolvedValueOnce({});
    await backfill({ send }, pause);
    expect(send.mock.calls[4][0].input.Item.status).toBe("complete");
  });

  it("refuses to start until the index is active", async () => {
    send.mockResolvedValueOnce({ Table: { GlobalSecondaryIndexes: [] } });
    await expect(backfill({ send }, pause)).rejects.toThrow("ACTIVE");
    expect(send).toHaveBeenCalledTimes(1);
  });
});
