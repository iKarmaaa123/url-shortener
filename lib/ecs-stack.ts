import { Stack } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { EcsConstruct } from "./modules/ecs-construct"
import type { VpcStack } from './vpc-stack';
import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as ecs from "aws-cdk-lib/aws-ecs"

export class EcsStack extends Stack {

  constructor(scope: Construct, vpcStack: VpcStack) {
    super(scope, "id");

    new EcsConstruct(this, "ecs", {
      clusterName: "my-ecs-v2-project",
      vpc: vpcStack.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC
      },
      securityGroups: [vpcStack.securityGroup],
      enableFargateCapacityProviders: true,
      serviceName: "url-shortener-ecs-service",
      desiredCount: 2,
      image: ecs.ContainerImage.fromRegistry("url-shortener"),
      environment: {
        TABLE_NAME: "url-shortener-table"
      }
    })
    }
  }
