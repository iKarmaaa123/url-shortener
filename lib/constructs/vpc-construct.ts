import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as ec2 from "aws-cdk-lib/aws-ec2"

export interface vpcConstructProps extends cdk.StackProps {
  vpcName: string
  cidr: string
  availabilityZones: string[]
  subnetConfiguration: ec2.SubnetConfiguration[]
  createInternetGateway: boolean
  securityGroupName: string
  allowAllOutbound: boolean
}

export class vpcConstruct extends Construct {
  public readonly vpc: ec2.Vpc
  public readonly securityGroup: ec2.SecurityGroup

  constructor(scope: Construct, id: string, props: vpcConstructProps) {
    super(scope, id);
    
    this.vpc = new ec2.Vpc(this, "vpc", {
      vpcName: props.vpcName,
      cidr: props.cidr,
      availabilityZones: props.availabilityZones,
      subnetConfiguration: props.subnetConfiguration,
      createInternetGateway: props.createInternetGateway
      }
    )

    this.securityGroup = new ec2.SecurityGroup(this, "mySecurityGroup", {
      vpc: this.vpc,
      securityGroupName: props.securityGroupName,
      allowAllOutbound: props.allowAllOutbound
    });

    this.securityGroup.addIngressRule (
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
    );

    this.securityGroup.addIngressRule (
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
    );
  }
}
