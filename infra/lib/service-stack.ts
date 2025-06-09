import { Construct } from "constructs";
import { Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Code, Function as Lambda, Runtime } from "aws-cdk-lib/aws-lambda";
import {
  AccessLogFormat,
  LambdaRestApi,
  LogGroupLogDestination,
} from "aws-cdk-lib/aws-apigateway";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import {
  EventBus,
  Rule,
  RuleTargetInput,
  Schedule,
} from "aws-cdk-lib/aws-events";
import {
  CloudWatchLogGroup,
  LambdaFunction,
} from "aws-cdk-lib/aws-events-targets";
import { Table } from "aws-cdk-lib/aws-dynamodb";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  EventType,
} from "aws-cdk-lib/aws-s3";
import { LambdaDestination } from "aws-cdk-lib/aws-s3-notifications";

interface ServiceStackProps extends StackProps {
  table: Table;
  botTable: Table;
}

export class ServiceStack extends Stack {
  private eventBus: EventBus;
  private proxy: Lambda;
  private handler: Lambda;
  private scheduled: Lambda;

  constructor(scope: Construct, id: string, props: ServiceStackProps) {
    super(scope, id, props);

    const rosterBucket = new Bucket(this, "roster-bucket", {
      bucketName: "bot-roster-bucket",
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
    });

    this.handler = new Lambda(this, "bot-handler", {
      functionName: "bot-handler",
      runtime: Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: Code.fromAsset("../bot/dist"),
      logRetention: RetentionDays.ONE_MONTH,
      environment: {
        REGION: props.env!.region!,
        CLASH_API_TOKEN: process.env.CLASH_API_TOKEN!,
        BOT_TOKEN: process.env.BOT_TOKEN!,
      },
      timeout: Duration.minutes(5),
      retryAttempts: 0,
    });
    props.table.grantReadWriteData(this.handler);

    this.scheduled = new Lambda(this, "bot-scheduled", {
      functionName: "bot-scheduled",
      runtime: Runtime.NODEJS_22_X,
      handler: "index.scheduled",
      code: Code.fromAsset("../bot/dist"),
      logRetention: RetentionDays.ONE_MONTH,
      environment: {
        REGION: props.env!.region!,
        CLASH_API_TOKEN: process.env.CLASH_API_TOKEN!,
        BOT_TOKEN: process.env.BOT_TOKEN!,
      },
      timeout: Duration.minutes(5),
      retryAttempts: 0,
    });

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

    new Rule(this, "bot-scheduled-recruiter-score", {
      schedule: Schedule.cron({
        minute: "0",
        hour: "12",
        weekDay: "SUN",
      }),
      targets: [
        new LambdaFunction(this.scheduled, {
          event: RuleTargetInput.fromObject({
            source: "tcn-bot-scheduled",
            "detail-type": "Generate Recruiter Score",
            detail: {
              guildId: "1111490767991615518",
            },
          }),
        }),
      ],
    });

    this.proxy = new Lambda(this, "bot-proxy", {
      functionName: "bot-proxy",
      runtime: Runtime.NODEJS_22_X,
      handler: "index.proxy",
      code: Code.fromAsset("../bot/dist"),
      logRetention: RetentionDays.ONE_MONTH,
      environment: {
        REGION: props.env!.region!,
        DISCORD_PUBLIC_KEY: process.env.DISCORD_PUBLIC_KEY!,
      },
    });
    this.eventBus.grantPutEventsTo(this.proxy);
    rosterBucket.grantRead(this.proxy);

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

    const rosterProcessor = new Lambda(this, "roster-processor", {
      functionName: "roster-processor",
      runtime: Runtime.NODEJS_22_X,
      handler: "index.processor",
      code: Code.fromAsset("../bot/dist"),
      logRetention: RetentionDays.ONE_MONTH,
      environment: {
        REGION: props.env!.region!,
        CLASH_API_TOKEN: process.env.CLASH_API_TOKEN!,
        BOT_TOKEN: process.env.BOT_TOKEN!,
      },
      timeout: Duration.minutes(3),
    });

    rosterBucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new LambdaDestination(rosterProcessor)
    );

    rosterBucket.grantRead(rosterProcessor);
    props.botTable.grantReadWriteData(rosterProcessor);
  }
}
