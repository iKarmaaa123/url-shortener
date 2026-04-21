import * as cdk from "aws-cdk-lib";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

export interface SqsConstructProps {
  queueName?: string;
  receiveMessageWaitTime?: cdk.Duration;
  visibilityTimeout?: cdk.Duration;
}

export class SqsConstruct extends Construct {
  public readonly sqsQueue: cdk.aws_sqs.Queue;

  constructor(scope: Construct, id: string, props: SqsConstructProps) {
    super(scope, id);

    this.sqsQueue = new sqs.Queue(this, "sqsQueue", {
      queueName: props.queueName,
      receiveMessageWaitTime: props.receiveMessageWaitTime,
      visibilityTimeout: props.visibilityTimeout,
    });
  }
}
