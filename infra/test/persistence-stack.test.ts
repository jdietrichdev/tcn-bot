import { App } from "aws-cdk-lib";
import { PersistenceStack } from "../lib/persistence-stack";
import { Template } from "aws-cdk-lib/assertions";

let app: App;
let stack: PersistenceStack;
let template: string;

test("Infrastructure created", () => {
  app = new App();
  stack = new PersistenceStack(app, "stack", {
    env: { account: "12345", region: "us-east-1" },
  });
  template = JSON.stringify(Template.fromStack(stack).toJSON(), null, 2);

  expect(template).toMatchSnapshot();
});
