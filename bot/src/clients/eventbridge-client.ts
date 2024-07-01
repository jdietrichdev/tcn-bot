import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
export const eventClient = new EventBridgeClient({
  region: process.env.REGION,
});
