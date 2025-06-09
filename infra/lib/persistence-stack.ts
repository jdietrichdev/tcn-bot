import { Construct } from "constructs";
import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import {
  AttributeType,
  Table,
  TableEncryption,
} from "aws-cdk-lib/aws-dynamodb";

export class PersistenceStack extends Stack {
  readonly table: Table;
  readonly botTable: Table;
  readonly rosterRable: Table;

  constructor(scope: Construct, id: string, props: StackProps) {
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

    //To be removed in next commit
    this.rosterRable = new Table(this, "roster-table", {
      tableName: "RosterTable",
      encryption: TableEncryption.AWS_MANAGED,
      partitionKey: {
        name: "pk",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: AttributeType.STRING,
      },
      timeToLiveAttribute: "expires",
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.botTable = new Table(this, "bot-table", {
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
      timeToLiveAttribute: "expires",
    });
  }
}
