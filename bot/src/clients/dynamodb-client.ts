import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
const dbClient = new DynamoDBClient({ region: process.env.REGION });

export const dynamoDbClient = DynamoDBDocument.from(dbClient);
