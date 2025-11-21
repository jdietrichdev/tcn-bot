#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ServiceStack } from "../lib/service-stack";
import { UIStack } from "../lib/ui-stack";
import {
  AttributeType,
  StreamViewType,
  Table,
  TableEncryption,
} from "aws-cdk-lib/aws-dynamodb";
import { RemovalPolicy, Stack } from "aws-cdk-lib";

const DEFAULT_STACK_PROPS = {
  env: { account: process.env.AWS_ACCOUNT, region: "us-east-1" },
};

const app = new cdk.App();

// Create a separate stack for the database tables
const dbStack = new Stack(app, "DatabaseStack", DEFAULT_STACK_PROPS);

const table = new Table(dbStack, "scheduling-table", {
  tableName: "SchedulingTable",
  partitionKey: {
    name: "pk",
    type: AttributeType.STRING,
  },
  sortKey: {
    name: "sk",
    type: AttributeType.STRING,
  },
  timeToLiveAttribute: "expiration",
});

const botTable = new Table(dbStack, "bot-table", {
  tableName: "BotTable",
  encryption: TableEncryption.AWS_MANAGED,
  partitionKey: {
    name: "pk",
    type: AttributeType.STRING,
  },
  sortKey: {
    name: "sk",
    type: AttributeType.STRING,
  },
  stream: StreamViewType.NEW_AND_OLD_IMAGES,
  timeToLiveAttribute: "expires",
  removalPolicy: RemovalPolicy.RETAIN,
});

const service = new ServiceStack(app, "DiscordBotStack", {
  ...DEFAULT_STACK_PROPS,
  table: table,
  botTable: botTable,
});

new UIStack(app, "DiscordUIStack", {
  ...DEFAULT_STACK_PROPS,
  rosterBucket: service.rosterBucket,
  transcriptBucket: service.transcriptBucket,
});