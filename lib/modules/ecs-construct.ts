import { ITableV2 } from "aws-cdk-lib/aws-dynamodb";
import { IDatabaseInstance } from "aws-cdk-lib/aws-rds"
import { IVpc, SubnetSelection, ISecurityGroup } from "aws-cdk-lib/aws-ec2";
import { IApplicationTargetGroup } from "aws-cdk-lib/aws-elasticloadbalancingv2"
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import { IQueue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

export interface EcsConstructProps {
  clusterName?: string;
  region: string;
  vpc?: IVpc;
  vpcSubnets?: SubnetSelection;
  securityGroups?: ISecurityGroup[];
  enableFargateCapacityProviders?: boolean;
  executionRoleName?: string;
  dynamodbTable: ITableV2;
  sqsQueue: IQueue;
  postgresql: IDatabaseInstance,
  desiredCount?: number;
  memoryLimitMiB?: number;
  cpu?: number;
  assignPublicIp?: boolean;
  enableExecuteCommand?: boolean;
  targetGroup?: IApplicationTargetGroup
}

export class EcsConstruct extends Construct {
  public readonly ecsApiService: ecs.FargateService;
  public readonly ecsWorkerService: ecs.FargateService;
  public readonly ecsDashboardService: ecs.FargateService;

  constructor(scope: Construct, id: string, props: EcsConstructProps) {
    super(scope, id);

    const executionRole = new iam.Role(this, "executionRole", {
      roleName: props.executionRoleName,
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy",
        ),
      ],
    });

    const apiTaskRole = new iam.Role(this, "apiTaskRole", {
      roleName: "apiTaskRole",
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    const workerTaskRole = new iam.Role(this, "workerTaskRole", {
      roleName: "workerTaskRole",
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    const dynamoDBPolicy = new iam.PolicyStatement({
      actions: ["dynamodb:GetItem", "dynamodb:PutItem"],
      resources: [props.dynamodbTable.tableArn],
    });

    const sqsPolicy = new iam.PolicyStatement({
      actions: ["sqs:ReceiveMessage", "sqs:SendMessage", "sqs:DeleteMessage"],
      resources: [props.sqsQueue.queueArn],
    });

    apiTaskRole.addToPrincipalPolicy(dynamoDBPolicy);
    workerTaskRole.addToPrincipalPolicy(sqsPolicy);

    const cluster = new ecs.Cluster(this, "Cluster", {
      clusterName: props.clusterName,
      vpc: props.vpc,
      enableFargateCapacityProviders: props.enableFargateCapacityProviders,
    });

    const apiTaskDefinition = new ecs.FargateTaskDefinition(this, "apiTaskDefinition", {
      memoryLimitMiB: props.memoryLimitMiB,
      cpu: props.cpu,
      executionRole: executionRole,
      taskRole: apiTaskRole,
    });

    const workerTaskDefinition = new ecs.FargateTaskDefinition(this, "workerTaskDefinition", {
      memoryLimitMiB: props.memoryLimitMiB,
      cpu: props.cpu,
      executionRole: executionRole,
      taskRole: workerTaskRole,
    });

    const dashboardTaskDefinition = new ecs.FargateTaskDefinition(this, "dashboardTaskDefinition", {
      memoryLimitMiB: props.memoryLimitMiB,
      cpu: props.cpu,
      executionRole: executionRole,
    });

    apiTaskDefinition.addContainer("web", {
      image: ecs.ContainerImage.fromRegistry(""),
      environment: {
        TABLE_NAME: props.dynamodbTable.tableName,
        AWS_REGION: props.region,
      },
      portMappings: [
        {
          containerPort: 8080,
        },
      ],
      logging: ecs.AwsLogDriver.awsLogs({ streamPrefix: "ecs-project-v2" }),
    });

    workerTaskDefinition.addContainer("web", {
      image: ecs.ContainerImage.fromRegistry(""),
      environment: {
        SQS_QUEUE_URL: props.sqsQueue.queueUrl,
        DATABASE_URL: props.postgresql.dbInstanceEndpointAddress,
      },
      logging: ecs.AwsLogDriver.awsLogs({ streamPrefix: "ecs-project-v2" }),
    });

    dashboardTaskDefinition.addContainer("web", {
      image: ecs.ContainerImage.fromRegistry(""),
      environment: {
        DATABASE_URL: props.postgresql.dbInstanceEndpointAddress,
      },
      portMappings: [
        {
          containerPort: 8081,
        },
      ],
      logging: ecs.AwsLogDriver.awsLogs({ streamPrefix: "ecs-project-v2" }),
    });

    this.ecsApiService = new ecs.FargateService(this, "apiFargateService", {
      serviceName: "ecsApiService",
      desiredCount: props.desiredCount,
      cluster,
      taskDefinition: apiTaskDefinition,
      vpcSubnets: props.vpcSubnets,
      securityGroups: props.securityGroups,
      assignPublicIp: props.assignPublicIp,
      enableExecuteCommand: props.enableExecuteCommand,
    });

    this.ecsWorkerService = new ecs.FargateService(this, "workerFargateService", {
      serviceName: "ecsWorkerService",
      desiredCount: props.desiredCount,
      cluster,
      taskDefinition: workerTaskDefinition,
      vpcSubnets: props.vpcSubnets,
      securityGroups: props.securityGroups,
      assignPublicIp: props.assignPublicIp,
      enableExecuteCommand: props.enableExecuteCommand,
    });

    this.ecsDashboardService = new ecs.FargateService(this, "dashboardFargateService", {
      serviceName: "ecsDashboardService",
      desiredCount: props.desiredCount,
      cluster,
      taskDefinition: dashboardTaskDefinition,
      vpcSubnets: props.vpcSubnets,
      securityGroups: props.securityGroups,
      assignPublicIp: props.assignPublicIp,
      enableExecuteCommand: props.enableExecuteCommand,
    });
  }
}
