import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import {
  AttributeType,
  StreamViewType,
  Table,
  TableEncryption,
} from "aws-cdk-lib/aws-dynamodb";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

export class PersistenceStack extends cdk.Stack {
  readonly table: Table;
  readonly botTable: Table;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    this.table = new Table(this, "scheduling-table", {
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

    this.botTable = new dynamodb.Table(this, 'BotTable', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Or another policy like DESTROY
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    this.botTable.addGlobalSecondaryIndex({
      indexName: 'recruitedBy-index',
      partitionKey: { name: 'recruitedBy', type: dynamodb.AttributeType.STRING },
    });
  }
}
