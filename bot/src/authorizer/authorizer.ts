import { APIGatewayProxyEvent } from "aws-lambda";
import nacl from "tweetnacl";

export const authorizeRequest = (event: APIGatewayProxyEvent): boolean => {
  const { body, headers } = event;

  const timestamp = headers["x-signature-timestamp"];
  const signature = headers["x-signature-ed25519"];

  if (!signature || !process.env.DISCORD_PUBLIC_KEY) {
    console.error("Missing necessary information");
    return false;
  }

  return nacl.sign.detached.verify(
    Buffer.from(timestamp + JSON.stringify(body)),
    Buffer.from(signature, "hex"),
    Buffer.from(process.env.DISCORD_PUBLIC_KEY, "hex")
  );
};
