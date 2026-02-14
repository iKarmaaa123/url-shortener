import * as cdk from 'aws-cdk-lib/core';
import { IVpc } from "aws-cdk-lib/aws-ec2"
import * as ecs from "aws-cdk-lib/aws-ecs";
import { IRole } from "aws-cdk-lib/aws-iam"
import { Construct } from 'constructs';

export interface ecsConstructProps extends cdk.StackProps {
    clusterName: string
    vpc: IVpc
    enableFargateCapacityProviders: boolean
    memoryLimitMiB: number
    cpu: number
    executionRole: IRole
    taskRole: IRole
    image: ecs.ContainerImage
}

export class ecsConstruct extends Construct {
  constructor(scope: Construct, id: string, props: ecsConstructProps) {
    super(scope, id);


    const cluster = new ecs.Cluster(this, "Cluster", {
      clusterName: props.clusterName,
      vpc: props.vpc,
      enableFargateCapacityProviders: props.enableFargateCapacityProviders
    })

    const taskDefinition = new ecs.FargateTaskDefinition(this, "taskDefinition", {
      memoryLimitMiB: props.memoryLimitMiB,
      cpu: props.cpu,
      executionRole: props.executionRole,
      taskRole: props.taskRole
    })

    taskDefinition.addContainer("web", {
      image: props.image
    })

    const fargateService = new ecs.FargateService(this, "fargateService", {
      cluster,
      taskDefinition,
    })
  }
}
