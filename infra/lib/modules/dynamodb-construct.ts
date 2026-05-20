import { RemovalPolicy } from "aws-cdk-lib/core";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import { TableV2 } from "aws-cdk-lib/aws-dynamodb";

export interface DynamoDBConstructProps {
  tableName?: string;
  partitionKey: dynamodb.Attribute;
  billing?: dynamodb.Billing;
  pointInTimeRecoveryEnabled: boolean
  removalPolicy?: RemovalPolicy;
}

export class DynamoDBConstruct extends Construct {
  public readonly dynamoDBTable: TableV2;

  constructor(scope: Construct, id: string, props: DynamoDBConstructProps) {
    super(scope, id);

    this.dynamoDBTable = new dynamodb.TableV2(this, "Table", {
      tableName: props.tableName,
      partitionKey: props.partitionKey,
      billing: props.billing,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: props.pointInTimeRecoveryEnabled,
      },
      removalPolicy: props.removalPolicy
    });
  }
}
