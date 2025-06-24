#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ServiceStack } from "../lib/service-stack";
import { PersistenceStack } from "../lib/persistence-stack";
import { UIStack } from "../lib/ui-stack";

const DEFAULT_STACK_PROPS = {
  env: { account: process.env.AWS_ACCOUNT, region: "us-east-1" },
};

const app = new cdk.App();
const persistence = new PersistenceStack(
  app,
  "DiscordBotPersistence",
  DEFAULT_STACK_PROPS
);
const service = new ServiceStack(app, "DiscordBotStack", {
  ...DEFAULT_STACK_PROPS,
  table: persistence.table,
  botTable: persistence.botTable,
});
new UIStack(app, "DiscordUIStack", {
  ...DEFAULT_STACK_PROPS,
  rosterBucket: service.rosterBucket,
  transcriptBucket: service.transcriptBucket,
});
