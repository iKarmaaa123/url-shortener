import { ITableV2 } from "aws-cdk-lib/aws-dynamodb";
import { IDatabaseInstance } from "aws-cdk-lib/aws-rds";
import { IVpc, SubnetSelection, ISecurityGroup, SubnetType } from "aws-cdk-lib/aws-ec2";
import { IApplicationTargetGroup, ITargetGroup, ApplicationListener, ListenerCondition, ListenerAction, ApplicationListenerRule } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import { Role } from "aws-cdk-lib/aws-iam";
import * as sm from "aws-cdk-lib/aws-secretsmanager";
import { IQueue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { Repository } from "aws-cdk-lib/aws-ecr";

export interface EcsConstructProps {
  clusterName?: string;
  region: string;
  vpc?: IVpc;
  privateSubnetType: SubnetType; 
  vpcSubnets?: SubnetSelection;
  securityGroups?: ISecurityGroup[];
  enableFargateCapacityProviders?: boolean;
  dynamodbTable: ITableV2;
  sqsQueue: IQueue;
  postgresql: IDatabaseInstance;
  desiredCount?: number;
  memoryLimitMiB?: number;
  cpu?: number;
  assignPublicIp?: boolean;
  enableExecuteCommand?: boolean;
  apiTargetGroup: IApplicationTargetGroup;
  apiGreenTargetGroup: IApplicationTargetGroup;
  dashboardTargetGroup: IApplicationTargetGroup;
  dashboardGreenTargetGroup: IApplicationTargetGroup;
  postgresqlSecret?: sm.ISecret
  alternateTargetGroup: ITargetGroup;
  deploymentControllerType: ecs.DeploymentControllerType;
  imageTag?: string;
  executionRole?: Role,
  apiTaskRole?: Role,
  workerTaskRole?: Role
  dashboardTaskRole?: Role
}

export class EcsConstruct extends Construct {
  public readonly ecsApiService: ecs.FargateService;
  public readonly ecsWorkerService: ecs.FargateService;
  public readonly ecsDashboardService: ecs.FargateService;

  constructor(scope: Construct, id: string, props: EcsConstructProps) {
    super(scope, id);

    const ecrApiRepo = Repository.fromRepositoryName(this, "apiRepositoryName", "api-repository")
    const ecrWorkerRepo = Repository.fromRepositoryName(this, "workerRepositoryName", "worker-repository")
    const ecrDashboardRepo = Repository.fromRepositoryName(this, "dashboardRepositoryName", "dashboard-repository")


    if (!props.postgresqlSecret) {
      throw new Error("postgresqlSecret not defined")
    }

    const secret = props.postgresqlSecret
    
    const cluster = new ecs.Cluster(this, "Cluster", {
      clusterName: props.clusterName,
      vpc: props.vpc,
      enableFargateCapacityProviders: props.enableFargateCapacityProviders,
    });

    const apiTaskDefinition = new ecs.FargateTaskDefinition(this, "apiTaskDefinition", {
      memoryLimitMiB: props.memoryLimitMiB,
      cpu: props.cpu,
      executionRole: props.executionRole,
      taskRole: props.apiTaskRole,
    });

    apiTaskDefinition.addContainer("apiTaskDefinition", {
      containerName: "apiContainer",
      image: ecs.ContainerImage.fromEcrRepository(ecrApiRepo, props.imageTag),
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
      executionRole: props.executionRole,
      taskRole: props.workerTaskRole,
    });

    workerTaskDefinition.addContainer("workerTaskDefinition", {
      containerName: "workerContainer",
      image: ecs.ContainerImage.fromEcrRepository(ecrWorkerRepo, props.imageTag),
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
      executionRole: props.executionRole,
      taskRole: props.dashboardTaskRole,
    });

     dashboardTaskDefinition.addContainer("dashboardTaskDefinition", {
      containerName: "dashboardContainer",
      image: ecs.ContainerImage.fromEcrRepository(ecrDashboardRepo, props.imageTag),
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

    this.ecsApiService.attachToApplicationTargetGroup(props.apiTargetGroup);
    this.ecsDashboardService.attachToApplicationTargetGroup(props.apiGreenTargetGroup);
    this.ecsApiService.attachToApplicationTargetGroup(props.dashboardTargetGroup);
    this.ecsDashboardService.attachToApplicationTargetGroup(props.dashboardGreenTargetGroup);
  }
}
