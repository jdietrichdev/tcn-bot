import { APIGatewayProxyEvent } from "aws-lambda";
import nacl from "tweetnacl";

export const authorizeRequest = (event: APIGatewayProxyEvent): boolean => {
  const { body, headers } = event;

  console.log(JSON.stringify(headers));

  const timestamp = headers["X-Signature-Timestamp"];
  const signature = headers["X-Signature-Ed25519"];

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
