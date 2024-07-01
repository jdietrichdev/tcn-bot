import { APIGatewayProxyEvent } from "aws-lambda";
import { authorizeRequest } from "../../src/authorizer/authorizer";
import nacl from "tweetnacl";

jest.mock("tweetnacl");

process.env.DISCORD_PUBLIC_KEY = "PUBLIC_KEY";
const mockEvent = {
  headers: {
    "x-signature-timestamp": "timestamp",
    "x-signature-ed25519": "signature",
  },
  body: JSON.stringify({ test: "test" }),
} as unknown as APIGatewayProxyEvent;

beforeEach(() => {
  jest.mocked(nacl.sign.detached.verify).mockReturnValue(true);
});

afterEach(jest.resetAllMocks);

test("should call verify with correct parameters", () => {
  authorizeRequest(mockEvent);
  expect(jest.mocked(nacl.sign.detached.verify)).toHaveBeenCalledWith(
    Buffer.from("timestamp" + mockEvent.body),
    Buffer.from("signature", "hex"),
    Buffer.from("PUBLIC_KEY", "hex")
  );
});

test("should return true when verification is successful", () => {
  expect(authorizeRequest(mockEvent)).toBeTruthy();
});

test("should return false when verification is unsuccessful", () => {
  jest.mocked(nacl.sign.detached.verify).mockReturnValue(false);
  expect(authorizeRequest(mockEvent)).toBeFalsy();
});

test("should return false when necessary data is not present", () => {
  delete mockEvent.headers["x-signature-ed25519"];
  expect(authorizeRequest(mockEvent)).toBeFalsy();
});
