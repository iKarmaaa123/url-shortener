import { Duration, Stack, StackProps } from "aws-cdk-lib/core";
import { Construct } from "constructs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { SqsConstruct } from "./modules/sqs-construct";
import { AppConstants } from "./config/app-constants";

export class MessagingStack extends Stack {
  public readonly sqsQueue: sqs.IQueue;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const sqsConstruct = new SqsConstruct(this, "sqs", {
      queueName: AppConstants.SQS_QUEUE_NAME,
      visibilityTimeout: Duration.seconds(AppConstants.SQS_VISIBILITY_TIMEOUT_SECONDS),
      receiveMessageWaitTime: Duration.seconds(AppConstants.SQS_RECEIVE_MESSAGE_WAIT_TIME_SECONDS),
    });

    this.sqsQueue = sqsConstruct.sqsQueue;
  }
}
