import { Construct } from "constructs";
import { Stack, StackProps } from "aws-cdk-lib";
import {
  Code,
  Function,
  Runtime,
} from "aws-cdk-lib/aws-lambda";
import {
  AccessLogFormat,
  LambdaRestApi,
  LogGroupLogDestination,
} from "aws-cdk-lib/aws-apigateway";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { EventBus, Rule } from "aws-cdk-lib/aws-events";
import { CloudWatchLogGroup, LambdaFunction } from "aws-cdk-lib/aws-events-targets";

export class InfraStack extends Stack {
  private eventBus: EventBus;
  private proxy: Function;
  private handler: Function;
  private api: LambdaRestApi;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    this.handler = new Function(this, 'bot-handler', {
      runtime: Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: Code.fromAsset("../bot/dist"),
      logRetention: RetentionDays.ONE_MONTH,
    })

    this.eventBus = new EventBus(this, "bot-events", {
      eventBusName: "tcn-bot-events",
    });

    const eventLog = new LogGroup(this, "event-audit-log", {
      logGroupName: "EventAuditLogs",
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

    new Rule(this, 'bot-event-handler', {
      ruleName: 'BotEventHandler',
      description: 'Handler for incoming bot events',
      eventBus: this.eventBus,
      eventPattern: {
        source: ['tcn-bot-event'],
        detailType: ['Bot Event Received'],
      },
      targets: [new LambdaFunction(this.handler)]
    });

    this.proxy = new Function(this, "bot-proxy", {
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
    });

    this.api = new LambdaRestApi(this, "discord-bot-api", {
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
