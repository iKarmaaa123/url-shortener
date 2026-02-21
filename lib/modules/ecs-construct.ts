import * as cdk from 'aws-cdk-lib/core';
import { IVpc, SubnetSelection, ISecurityGroup } from "aws-cdk-lib/aws-ec2"
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import { IRole } from "aws-cdk-lib/aws-iam"
import { Construct } from 'constructs';

export interface EcsConstructProps extends cdk.StackProps {
    clusterName?: string;
    vpc?: IVpc;
    vpcSubnets?: SubnetSelection;
    securityGroups?: ISecurityGroup[];
    enableFargateCapacityProviders?: boolean;
    executionRoleName?: string;
    taskRoleName?: string;
    serviceName?: string;
    desiredCount?: number;
    image: ecs.ContainerImage;
    environment?: {
      TABLE_NAME?: string;
    }
}

export class EcsConstruct extends Construct {
  constructor(scope: Construct, id: string, props: EcsConstructProps) {
    super(scope, id);

    const executionRole = new iam.Role(this, "executionRole", {
      roleName: props.executionRoleName,
      assumedBy: new iam.ServicePrincipal("ecs.amazonaws.com"),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy")]
    })

    const taskRole = new iam.Role(this, "taskRole", {
      roleName: props.taskRoleName,
      assumedBy: new iam.ServicePrincipal("ecs.amazonaws.com"),
    })

    const dynamoDBPolicy = new iam.PolicyStatement({
      actions: [
        "dynamodb:PutItem",
        "dynamodb:GetItem"
      ]
    })

    taskRole.addToPrincipalPolicy(dynamoDBPolicy)

    const cluster = new ecs.Cluster(this, "Cluster", {
      clusterName: props.clusterName,
      vpc: props.vpc,
      enableFargateCapacityProviders: props.enableFargateCapacityProviders
    })

    const taskDefinition = new ecs.FargateTaskDefinition(this, "taskDefinition", {
      memoryLimitMiB: 512,
      cpu: 256,
      executionRole: executionRole,
      taskRole: taskRole
    })

    taskDefinition.addContainer("web", {
      image: props.image,
      environment: props.environment
    })

    const fargateService = new ecs.FargateService(this, "fargateService", {
      serviceName: props.serviceName,
      desiredCount: props.desiredCount,
      cluster,
      taskDefinition,
      vpcSubnets: props.vpcSubnets,
      securityGroups: props.securityGroups,
      assignPublicIp: true
    })
  }
}
