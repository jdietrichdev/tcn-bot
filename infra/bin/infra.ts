#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ServiceStack } from "../lib/service-stack";
import { PersistenceStack } from "../lib/persistence-stack";

const DEFAULT_STACK_PROPS = {
  env: { account: process.env.AWS_ACCOUNT, region: "us-east-1" },
};

const app = new cdk.App();
const persistence = new PersistenceStack(
  app,
  "DiscordBotPersistence",
  DEFAULT_STACK_PROPS
);
new ServiceStack(app, "DiscordBotStack", {
  ...DEFAULT_STACK_PROPS,
  table: persistence.table,
  rosterTable: persistence.rosterTable,
  rosterBucket: persistence.rosterBucket,
});
