import { App } from "aws-cdk-lib";
import type { PersistenceStack as PersistenceStackType } from "../lib/persistence-stack";
import { Template } from "aws-cdk-lib/assertions";

const { PersistenceStack }: typeof import("../lib/persistence-stack") =
  require("../lib/persistence-stack.ts");
let app: App;
let stack: PersistenceStackType;
let template: string;

test("Infrastructure created", () => {
  app = new App();
  stack = new PersistenceStack(app, "stack", {
    env: { account: "12345", region: "us-east-1" },
  });
  template = JSON.stringify(Template.fromStack(stack).toJSON(), null, 2);

  expect(template).toMatchSnapshot();
});
