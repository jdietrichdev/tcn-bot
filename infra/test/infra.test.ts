import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { InfraStack } from "../lib/infra-stack";

let app: App;
let stack: InfraStack;
let template: string;

test("Infrastructure created", () => {
  app = new App();
  stack = new InfraStack(app, "stack", {
    env: { account: "12345", region: "us-east-1" },
  });
  template = JSON.stringify(Template.fromStack(stack).toJSON(), null, 2);
  template = template.replace(/("S3Key": )".*\.zip"/g, '$1"files.zip"');

  expect(template).toMatchSnapshot();
});
