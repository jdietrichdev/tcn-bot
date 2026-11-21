const { DynamoDBClient, DescribeTableCommand } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocument,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const tableName = "BotTable";
const markerKey = { pk: "system#link-index", sk: "migration" };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function backfill(client, pause = wait) {
  const table = await client.send(new DescribeTableCommand({ TableName: tableName }));
  const index = table.Table?.GlobalSecondaryIndexes?.find(
    (item) => item.IndexName === "normalized-player-tag-index"
  );
  if (index?.IndexStatus !== "ACTIVE") {
    throw new Error("Deploy the normalized-player-tag-index and wait until it is ACTIVE first.");
  }

  await client.send(new PutCommand({
    TableName: tableName,
    Item: { ...markerKey, status: "in-progress" },
  }));
  let startKey;
  let updated = 0;
  do {
    const result = await client.send(new ScanCommand({
      TableName: tableName,
      ConsistentRead: true,
      Limit: 5,
      FilterExpression: "begins_with(sk, :prefix)",
      ProjectionExpression: "pk, sk, normalizedPlayerTag",
      ExpressionAttributeValues: { ":prefix": "player#" },
      ReturnConsumedCapacity: "TOTAL",
      ExclusiveStartKey: startKey,
    }));
    for (const item of result.Items ?? []) {
      if (typeof item.pk !== "string" || typeof item.sk !== "string") {
        throw new Error("Invalid link record key");
      }
      const normalized = `player#${item.sk.slice(7).toUpperCase()}`;
      if (item.normalizedPlayerTag === normalized) continue;
      try {
        await client.send(new UpdateCommand({
          TableName: tableName,
          Key: { pk: item.pk, sk: item.sk },
          UpdateExpression: "SET normalizedPlayerTag = :tag",
          ConditionExpression: "attribute_exists(pk)",
          ExpressionAttributeValues: { ":tag": normalized },
        }));
        updated++;
        await pause(500);
      } catch (error) {
        if (error.name !== "ConditionalCheckFailedException") throw error;
      }
    }
    startKey = result.LastEvaluatedKey;
    if (startKey) {
      const units = result.ConsumedCapacity?.CapacityUnits;
      if (typeof units !== "number" || !Number.isFinite(units) || units < 0) {
        throw new Error("DynamoDB did not report scan read capacity");
      }
      await pause(Math.ceil(units * 1000));
    }
  } while (startKey);
  await client.send(new PutCommand({
    TableName: tableName,
    Item: { ...markerKey, status: "complete" },
  }));
  console.log(`Link index backfill complete. Updated ${updated} records.`);
}

if (require.main === module) {
  const client = DynamoDBDocument.from(new DynamoDBClient({
    region: process.env.REGION,
    maxAttempts: 10,
  }));
  backfill(client).catch((error) => {
    console.error("Link index backfill failed; it can be safely rerun.", error);
    process.exitCode = 1;
  });
}

module.exports = { backfill };
