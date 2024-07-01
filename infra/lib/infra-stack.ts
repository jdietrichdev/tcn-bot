import { Construct } from 'constructs';
import { Stack, StackProps } from 'aws-cdk-lib';
import { AccessLogFormat, LogGroupLogDestination, MockIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { LogGroup } from 'aws-cdk-lib/aws-logs';

export class InfraStack extends Stack {
  private api: RestApi;
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const accessLogs = new LogGroup(this, 'access-logs', {
      logGroupName: 'BotAccessLogs',
    })

    this.api = new RestApi(this, 'discord-bot-api', {
      restApiName: 'DiscordBotApi',
      deployOptions: {
        stageName: 'prod',
        accessLogDestination: new LogGroupLogDestination(accessLogs),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields()
      }
    });

    this.api.root.resourceForPath('v1/bot').addMethod('POST', new MockIntegration({
      integrationResponses: [
        { statusCode: '200' }
      ]
    }), {
      methodResponses: [
        { statusCode: '200' },
      ]
    });
  }
}
