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
  actions?: string[];
  resources?: string[];
  serviceName?: string;
  desiredCount?: number;
  memoryLimitMiB?: number;
  cpu?: number;
  portMappings?: ecs.PortMapping[];
  image: ecs.ContainerImage;
  environment?: {
    [key: string]: string;
  };
  assignPublicIp?: boolean;
  enableExecuteCommand?: boolean;
}

export class EcsConstruct extends Construct {
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
      actions: props.actions,
      resources: props.resources,
    });

    taskRole.addToPrincipalPolicy(dynamoDBPolicy);

    const cluster = new ecs.Cluster(this, "Cluster", {
      clusterName: props.clusterName,
      vpc: props.vpc,
      enableFargateCapacityProviders: props.enableFargateCapacityProviders,
    });

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "taskDefinition",
      {
        memoryLimitMiB: props.memoryLimitMiB,
        cpu: props.cpu,
        executionRole: executionRole,
        taskRole: taskRole,
      },
    );

    taskDefinition.addContainer("web", {
      image: props.image,
      environment: props.environment,
      portMappings: props.portMappings,
      logging: ecs.AwsLogDriver.awsLogs({ streamPrefix: "ecs-project-v2" }),
    });

    new ecs.FargateService(this, "fargateService", {
      serviceName: props.serviceName,
      desiredCount: props.desiredCount,
      cluster,
      taskDefinition,
      vpcSubnets: props.vpcSubnets,
      securityGroups: props.securityGroups,
      assignPublicIp: props.assignPublicIp,
      enableExecuteCommand: props.enableExecuteCommand
    });
  }
}
