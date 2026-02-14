import * as cdk from 'aws-cdk-lib/core';
import { IVpc, SubnetSelection, ISecurityGroup } from "aws-cdk-lib/aws-ec2"
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import { IRole } from "aws-cdk-lib/aws-iam"
import { Construct } from 'constructs';

export interface ecsConstructProps extends cdk.StackProps {
    clusterName?: string
    vpc: IVpc
    vpcSubnets: SubnetSelection
    securityGroups: ISecurityGroup[]
    enableFargateCapacityProviders?: boolean
    executionRole?: IRole
    taskRole?: IRole
    serviceName?: string
    desiredCount?: number
    image: ecs.ContainerImage
    environment?: {
      TABLE_NAME?: string
    }
}

export class ecsConstruct extends Construct {
  constructor(scope: Construct, id: string, props: ecsConstructProps) {
    super(scope, id);

    const executionRole = new iam.Role(this, "executionRole", {
      assumedBy: new iam.ServicePrincipal("ecs.amazonaws.com"),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy")]
    })


    const cluster = new ecs.Cluster(this, "Cluster", {
      clusterName: props.clusterName,
      vpc: props.vpc,
      enableFargateCapacityProviders: props.enableFargateCapacityProviders
    })

    const taskDefinition = new ecs.FargateTaskDefinition(this, "taskDefinition", {
      memoryLimitMiB: 512,
      cpu: 256,
      executionRole: executionRole,
      taskRole: props.taskRole
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
