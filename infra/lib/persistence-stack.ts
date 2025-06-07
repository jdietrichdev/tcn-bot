import { Construct } from "constructs";
import { Stack, StackProps } from "aws-cdk-lib";
import { AttributeType, Table, TableEncryption } from "aws-cdk-lib/aws-dynamodb";
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";

export class PersistenceStack extends Stack {
  readonly table: Table;
  readonly rosterTable: Table;
  readonly rosterBucket: Bucket;

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

    this.rosterTable = new Table(this, 'roster-table', {
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
      timeToLiveAttribute: "expires"
    });

    this.rosterBucket = new Bucket(this, 'roster-bucket', {
      bucketName: 'bot-roster-bucket',
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
    });
  }
}
