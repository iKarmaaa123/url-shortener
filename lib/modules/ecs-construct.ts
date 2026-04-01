import { IVpc, SubnetSelection, ISecurityGroup } from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface EcsConstructProps {
  clusterName?: string;
  vpc?: IVpc;
  vpcSubnets?: SubnetSelection;
  securityGroups?: ISecurityGroup[];
  enableFargateCapacityProviders?: boolean;
  executionRoleName?: string;
  taskRoleName?: string;
  dynamodbActions?: string[];
  dynamodbResources?: string[];
  sqsActions?: string[];
  sqsResources?: string[];
  serviceName?: string;
  desiredCount?: number;
  memoryLimitMiB?: number;
  cpu?: number;
  portMappings?: ecs.PortMapping[];
  environment?: {
    [key: string]: string;
  };
  assignPublicIp?: boolean;
  enableExecuteCommand?: boolean;
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

    const taskRole = new iam.Role(this, "taskRole", {
      roleName: props.taskRoleName,
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    const dynamoDBPolicy = new iam.PolicyStatement({
      actions: props.dynamodbActions,
      resources: props.dynamodbResources,
    });

    const sqsPolicy = new iam.PolicyStatement({
      actions: props.sqsActions,
      resources: props.sqsResources
    })

    taskRole.addToPrincipalPolicy(dynamoDBPolicy);
    taskRole.addToPrincipalPolicy(sqsPolicy)

    const cluster = new ecs.Cluster(this, "Cluster", {
      clusterName: props.clusterName,
      vpc: props.vpc,
      enableFargateCapacityProviders: props.enableFargateCapacityProviders,
    });

    const apiTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      "apiTaskDefinition",
      {
        memoryLimitMiB: props.memoryLimitMiB,
        cpu: props.cpu,
        executionRole: executionRole,
        taskRole: taskRole,
      },
    );

    const workerTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      "workerTaskDefinition",
      {
        memoryLimitMiB: props.memoryLimitMiB,
        cpu: props.cpu,
        executionRole: executionRole,
        taskRole: taskRole,
      },
    );

    const dashboardTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      "dashboardTaskDefinition",
      {
        memoryLimitMiB: props.memoryLimitMiB,
        cpu: props.cpu,
        executionRole: executionRole,
        taskRole: taskRole,
      },
    );

    apiTaskDefinition.addContainer("web", {
      image: props.image,
      environment: props.environment,
      portMappings: props.portMappings,
      logging: ecs.AwsLogDriver.awsLogs({ streamPrefix: "ecs-project-v2" }),
    });

    workerTaskDefinition.addContainer("web", {
      image: props.image,
      environment: props.environment,
      portMappings: props.portMappings,
      logging: ecs.AwsLogDriver.awsLogs({ streamPrefix: "ecs-project-v2" }),
    });

    dashboardTaskDefinition.addContainer("web", {
      image: props.image,
      environment: props.environment,
      portMappings: props.portMappings,
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
      enableExecuteCommand: props.enableExecuteCommand
    });

     this.ecsWorkerService = new ecs.FargateService(this, "workerFargateService", {
      serviceName: "ecsWorkerService",
      desiredCount: props.desiredCount,
      cluster,
      taskDefinition: workerTaskDefinition,
      vpcSubnets: props.vpcSubnets,
      securityGroups: props.securityGroups,
      assignPublicIp: props.assignPublicIp,
      enableExecuteCommand: props.enableExecuteCommand
    });

     this.ecsDashboardService = new ecs.FargateService(this, "dashboardFargateService", {
      serviceName: "ecsDashboardService",
      desiredCount: props.desiredCount,
      cluster,
      taskDefinition: dashboardTaskDefinition,
      vpcSubnets: props.vpcSubnets,
      securityGroups: props.securityGroups,
      assignPublicIp: props.assignPublicIp,
      enableExecuteCommand: props.enableExecuteCommand
    });
  }
}
