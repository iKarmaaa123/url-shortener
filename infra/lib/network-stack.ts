import { Stack, StackProps } from "aws-cdk-lib/core";
import { Construct } from "constructs";
import { VpcConstruct } from "./modules/vpc-construct";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { AppConstants } from "./config/app-constants";
import { AppSettings } from "./config/app-settings";

export class NetworkStack extends Stack {
  public readonly vpc: ec2.IVpc;
  public readonly ecsSecurityGroup: ec2.ISecurityGroup;
  public readonly albSecurityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpcConstruct = new VpcConstruct(this, "vpc", {
      vpcName: AppConstants.VPC_NAME,
      ipAddresses: ec2.IpAddresses.cidr(AppConstants.VPC_CIDR),
      cidrMask: AppConstants.VPC_CIDR_MASK,
      publicSubnetName: AppConstants.PUBLIC_SUBNET_NAME,
      privateSubnetName: AppConstants.PRIVATE_SUBNET_NAME,    
      publicSubnetType: ec2.SubnetType.PUBLIC,
      privateSubnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      description: "Group of private subnets",
      availabilityZones: AppConstants.AVAILABILITY_ZONES,
      createInternetGateway: AppSettings.CREATE_INTERNET_GATEWAY,
      ecsSecurityGroupName: AppConstants.ECS_SECURITY_GROUP_NAME,
      albSecurityGroupName: AppConstants.ALB_SECURITY_GROUP_NAME,
      allowAllOutbound: AppSettings.ALLOW_ALL_OUTBOUND,
      natGateways: AppConstants.NAT_GATEWAYS,
      serviceRegion: this.region,
      ipAddressType: ec2.VpcEndpointIpAddressType.IPV4,
      privateDnsEnabled: AppSettings.PRIVATE_DNS_ENABLED,
      maxAzs: this.availabilityZones.length,
    });

    this.vpc = vpcConstruct.vpc;
    this.ecsSecurityGroup = vpcConstruct.ecsSecurityGroup;
    this.albSecurityGroup = vpcConstruct.albSecurityGroup;
  }
}
