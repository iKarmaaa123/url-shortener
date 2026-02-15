import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as ec2 from "aws-cdk-lib/aws-ec2"
import { vpcConstruct } from './constructs/vpc-construct';

export class ecsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const vpc = new vpcConstruct(this, "vpc", {
      vpcName: "ecs-vpc",
      cidr: "10.0.0.0/16",
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "ecs-plublic-subnet",
          subnetType: ec2.SubnetType.PUBLIC,
        }
        // {
        //   cidrMask: 24,
        //   name: 'application',
        //   subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        // }
      ],
      availabilityZones: ["us-east-1a", "us-east-1b"],
      createInternetGateway: true,
      securityGroupName: "ecs-security-group",
      allowAllOutbound: true
    });
  }
}
