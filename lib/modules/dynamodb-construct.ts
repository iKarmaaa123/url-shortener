import * as cdk from "aws-cdk-lib/core";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export interface DynamoDBConstructProps extends cdk.StackProps {
  tableName: string;
  partitionKey: dynamodb.Attribute;
  billing: dynamodb.Billing;
  pointInTimeRecoverySpecification: dynamodb.PointInTimeRecoverySpecification;
}

export class DynamoDBConstruct extends Construct {
  public readonly dynamoDBTable: dynamodb.TableV2;

  constructor(scope: Construct, id: string, props: DynamoDBConstructProps) {
    super(scope, id);

    this.dynamoDBTable = new dynamodb.TableV2(this, "Table", {
      tableName: props.tableName,
      partitionKey: props.partitionKey,
      billing: props.billing,
      pointInTimeRecoverySpecification: props.pointInTimeRecoverySpecification
    });
  }
}
