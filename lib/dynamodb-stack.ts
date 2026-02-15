import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class ecsConstruct extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.Stack) {
    super(scope, id);

    const table = new dynamodb.TableV2(this, 'Table', {
      tableName: "url-shortener-table",
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true
      }
    });
  }
}