import { Construct } from "constructs";
import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Code, Function as Lambda, Runtime } from "aws-cdk-lib/aws-lambda";
import {
  AccessLogFormat,
  LambdaRestApi,
  LogGroupLogDestination,
} from "aws-cdk-lib/aws-apigateway";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { EventBus, Rule } from "aws-cdk-lib/aws-events";
import {
  CloudWatchLogGroup,
  LambdaFunction,
} from "aws-cdk-lib/aws-events-targets";
import { Table } from "aws-cdk-lib/aws-dynamodb";

interface ServiceStackProps extends StackProps {
  table: Table;
}

export class ServiceStack extends Stack {
  private eventBus: EventBus;
  private proxy: Lambda;
  private handler: Lambda;

  constructor(scope: Construct, id: string, props: ServiceStackProps) {
    super(scope, id, props);

    this.handler = new Lambda(this, "bot-handler", {
      runtime: Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: Code.fromAsset("../bot/dist"),
      logRetention: RetentionDays.ONE_MONTH,
      environment: {
        CLASH_API_TOKEN: process.env.CLASH_API_TOKEN!,
      },
    });
    props.table.grantReadWriteData(this.handler);

    this.eventBus = new EventBus(this, "bot-events", {
      eventBusName: "tcn-bot-events",
    });

    const eventLog = new LogGroup(this, "event-audit-log", {
      logGroupName: "EventAuditLogs",
      removalPolicy: RemovalPolicy.DESTROY,
    });

    new Rule(this, "audit-log-rule", {
      ruleName: "AuditLogRule",
      description: "Audit log for events",
      eventBus: this.eventBus,
      eventPattern: {
        source: ["tcn-bot-event"],
      },
      targets: [new CloudWatchLogGroup(eventLog)],
    });

    new Rule(this, "bot-event-handler", {
      ruleName: "BotEventHandler",
      description: "Handler for incoming bot events",
      eventBus: this.eventBus,
      eventPattern: {
        source: ["tcn-bot-event"],
        detailType: ["Bot Event Received"],
      },
      targets: [new LambdaFunction(this.handler)],
    });

    this.proxy = new Lambda(this, "bot-proxy", {
      runtime: Runtime.NODEJS_20_X,
      handler: "index.proxy",
      code: Code.fromAsset("../bot/dist"),
      logRetention: RetentionDays.ONE_MONTH,
      environment: {
        REGION: props.env!.region!,
        DISCORD_PUBLIC_KEY: process.env.DISCORD_PUBLIC_KEY!,
      },
    });
    this.eventBus.grantPutEventsTo(this.proxy);

    const accessLogs = new LogGroup(this, "access-logs", {
      logGroupName: "BotAccessLogs",
      removalPolicy: RemovalPolicy.DESTROY,
    });

    new LambdaRestApi(this, "discord-bot-api", {
      restApiName: "DiscordBotApi",
      handler: this.proxy,
      deployOptions: {
        stageName: "prod",
        accessLogDestination: new LogGroupLogDestination(accessLogs),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields(),
      },
    });
  }
}
