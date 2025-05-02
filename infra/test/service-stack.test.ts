import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { ServiceStack } from "../lib/service-stack";
import { Table } from "aws-cdk-lib/aws-dynamodb";

let app: App;
let stack: ServiceStack;
let template: string;

process.env.DISCORD_PUBLIC_KEY = "TEST_KEY";
process.env.CLASH_API_TOKEN = "TEST_API_TOKEN";
process.env.BOT_TOKEN = "BOT_TOKEN";

test("Infrastructure created", () => {
  app = new App();
  stack = new ServiceStack(app, "stack", {
    env: { account: "12345", region: "us-east-1" },
    table: { grantReadWriteData: jest.fn() } as unknown as Table,
  });
  template = JSON.stringify(Template.fromStack(stack).toJSON(), null, 2);
  template = template.replace(/("S3Key": )".*\.zip"/g, '$1"files.zip"');

  expect(template).toMatchSnapshot();
});
