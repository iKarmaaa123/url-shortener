import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam"
import { ITableV2 } from "aws-cdk-lib/aws-dynamodb";
import { IQueue } from "aws-cdk-lib/aws-sqs";

export interface IamConstructProps {
  executionRoleName: string
  dynamodbTable: ITableV2
  sqsQueue: IQueue
}

export class IamConstruct extends Construct {
  public readonly executionRole: iam.Role
  public readonly apiTaskRole: iam.Role
  public readonly workerTaskRole: iam.Role
  public readonly dashboardTaskRole: iam.Role

  constructor(scope: Construct, id: string, props: IamConstructProps) {
    super(scope, id)

    this.executionRole = new iam.Role(this, "executionRole", {
      roleName: props.executionRoleName,
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
            "service-role/AmazonECSTaskExecutionRolePolicy",
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
            "AWSSecretsManagerClientReadOnlyAccess"
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
            "AmazonECSInfrastructureRolePolicyForLoadBalancers"
        )
      ],
    });

    this.apiTaskRole = new iam.Role(this, "apiTaskRole", {
        roleName: "apiTaskRole",
        assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    this.workerTaskRole = new iam.Role(this, "workerTaskRole", {
        roleName: "workerTaskRole",
        assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    this.dashboardTaskRole = new iam.Role(this, "dashboardTaskRole", {
        roleName: "dashboardTaskRole",
        assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    const dynamoDBPolicy = new iam.PolicyStatement({
        actions: ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"],
        resources: [props.dynamodbTable.tableArn],
    });

    const sqsPolicy = new iam.PolicyStatement({
        actions: ["sqs:ReceiveMessage", "sqs:SendMessage", "sqs:DeleteMessage"],
        resources: [props.sqsQueue.queueArn],
    });

    this.apiTaskRole.addToPrincipalPolicy(dynamoDBPolicy);
    this.apiTaskRole.addToPrincipalPolicy(sqsPolicy)
    this.workerTaskRole.addToPrincipalPolicy(sqsPolicy);
  }
}