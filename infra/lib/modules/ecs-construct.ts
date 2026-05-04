import { ITableV2 } from "aws-cdk-lib/aws-dynamodb";
import { IDatabaseInstance } from "aws-cdk-lib/aws-rds";
import { IVpc, SubnetSelection, ISecurityGroup, SubnetType } from "aws-cdk-lib/aws-ec2";
import { IApplicationTargetGroup, ITargetGroup, ApplicationListener, ListenerCondition, ListenerAction, ApplicationListenerRule } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sm from "aws-cdk-lib/aws-secretsmanager";
import { IQueue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

export interface EcsConstructProps {
  clusterName?: string;
  region: string;
  vpc?: IVpc;
  privateSubnetType: SubnetType;
  vpcSubnets?: SubnetSelection;
  securityGroups?: ISecurityGroup[];
  enableFargateCapacityProviders?: boolean;
  executionRoleName?: string;
  dynamodbTable: ITableV2;
  sqsQueue: IQueue;
  postgresql: IDatabaseInstance;
  desiredCount?: number;
  memoryLimitMiB?: number;
  cpu?: number;
  assignPublicIp?: boolean;
  enableExecuteCommand?: boolean;
  targetGroup?: IApplicationTargetGroup;
  postgresqlSecret?: sm.ISecret
  alternateTargetGroup: ITargetGroup;
  deploymentControllerType: ecs.DeploymentControllerType;
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
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AWSSecretsManagerClientReadOnlyAccess"
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonECSInfrastructureRolePolicyForLoadBalancers"
        )
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

    const dashboardTaskRole = new iam.Role(this, "dashboardTaskRole", {
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

    if (!props.postgresqlSecret) {
      throw new Error("postgresqlSecret not defined")
    }

    const secret = props.postgresqlSecret

    apiTaskRole.addToPrincipalPolicy(dynamoDBPolicy);
    apiTaskRole.addToPrincipalPolicy(sqsPolicy)
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

    apiTaskDefinition.addContainer("apiTaskDefinition", {
      containerName: "apiContainer",
      image: ecs.ContainerImage.fromRegistry(
        "648767092427.dkr.ecr.us-east-1.amazonaws.com/api-repository",
      ),
      environment: {
        SQS_QUEUE_URL: props.sqsQueue.queueUrl,
        TABLE_NAME: props.dynamodbTable.tableName,
        AWS_DEFAULT_REGION: props.region,
      },
      portMappings: [
        {
          containerPort: 8080,
        },
      ],
      logging: ecs.AwsLogDriver.awsLogs({ streamPrefix: "ecs-project-v2" }),
    });

    const workerTaskDefinition = new ecs.FargateTaskDefinition(this, "workerTaskDefinition", {
      memoryLimitMiB: props.memoryLimitMiB,
      cpu: props.cpu,
      executionRole: executionRole,
      taskRole: workerTaskRole,
    });

    workerTaskDefinition.addContainer("workerTaskDefinition", {
      containerName: "workerContainer",
      image: ecs.ContainerImage.fromRegistry("648767092427.dkr.ecr.us-east-1.amazonaws.com/worker-repository"),
      environment: {
        SQS_QUEUE_URL: props.sqsQueue.queueUrl,
        AWS_DEFAULT_REGION: props.region,
      },
      portMappings: [
        {
          containerPort: 8090,
        },
      ],
      logging: ecs.AwsLogDriver.awsLogs({ streamPrefix: "ecs-project-v2" }),
      secrets: {
        DB_CREDENTIALS: ecs.Secret.fromSecretsManager(secret)
      },
    });

    const dashboardTaskDefinition = new ecs.FargateTaskDefinition(this, "dashboardTaskDefinition", {
      memoryLimitMiB: props.memoryLimitMiB,
      cpu: props.cpu,
      executionRole: executionRole,
      taskRole: dashboardTaskRole,
    });

     dashboardTaskDefinition.addContainer("dashboardTaskDefinition", {
      containerName: "dashboardContainer",
      image: ecs.ContainerImage.fromRegistry(
        "648767092427.dkr.ecr.us-east-1.amazonaws.com/dashboard-repository",
      ),
      portMappings: [
        {
          containerPort: 8081,
        },
      ],
      logging: ecs.AwsLogDriver.awsLogs({ streamPrefix: "ecs-project-v2" }),
      secrets: {
        DB_CREDENTIALS: ecs.Secret.fromSecretsManager(secret)
      }
    });

    this.ecsApiService = new ecs.FargateService(this, "apiFargateService", {
      serviceName: "ecsApiService",
      desiredCount: props.desiredCount,
      cluster,
      taskDefinition: apiTaskDefinition,
      vpcSubnets: {
        subnetType: props.privateSubnetType,
      },
      securityGroups: props.securityGroups,
      assignPublicIp: props.assignPublicIp,
      enableExecuteCommand: props.enableExecuteCommand,
      deploymentController: {
        type: props.deploymentControllerType
      },
    });

    this.ecsWorkerService = new ecs.FargateService(this, "workerFargateService", {
      serviceName: "ecsWorkerService",
      desiredCount: props.desiredCount,
      cluster,
      taskDefinition: workerTaskDefinition,
      vpcSubnets: {
        subnetType: props.privateSubnetType,
      },
      securityGroups: props.securityGroups,
      assignPublicIp: props.assignPublicIp,
      enableExecuteCommand: props.enableExecuteCommand,
    });

    this.ecsDashboardService = new ecs.FargateService(this, "dashboardFargateService", {
      serviceName: "ecsDashboardService",
      desiredCount: props.desiredCount,
      cluster,
      taskDefinition: dashboardTaskDefinition,
      vpcSubnets: {
        subnetType: props.privateSubnetType,
      },
      securityGroups: props.securityGroups,
      assignPublicIp: props.assignPublicIp,
      enableExecuteCommand: props.enableExecuteCommand,
      deploymentController: {
        type: props.deploymentControllerType
      }
    });
  }
}
