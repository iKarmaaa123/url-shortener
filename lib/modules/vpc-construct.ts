import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";

export interface vpcConstructProps {
  vpcName?: string;
  ipAddresses: ec2.IIpAddresses;
  availabilityZones: string[];
  subnetConfiguration: ec2.SubnetConfiguration[];
  createInternetGateway?: boolean;
  ecsSecurityGroupName?: string;
  albSecurityGroupName?: string;
  natGateways?: number;
  allowAllOutbound?: boolean;
  mapPublicIpOnLaunch?: boolean;
  serviceRegion: string;
  ipAddressType: ec2.VpcEndpointIpAddressType;
}

export class VpcConstruct extends Construct {
  public readonly vpc: ec2.IVpc;
  public readonly ecsSecurityGroup: ec2.SecurityGroup;
  public readonly albSecurityGroup: ec2.SecurityGroup;
  public readonly publicSubnets: ec2.SubnetSelection;
  public readonly privateSubnets: ec2.SubnetSelection;

  constructor(scope: Construct, id: string, props: vpcConstructProps) {
    super(scope, id);

    this.vpc = new ec2.Vpc(this, "vpc", {
      ipAddresses: props.ipAddresses,
      vpcName: props.vpcName,
      createInternetGateway: props.createInternetGateway,
      availabilityZones: props.availabilityZones,
      natGateways: props.natGateways,
      subnetConfiguration: props.subnetConfiguration,
    });

    this.publicSubnets = this.vpc.selectSubnets({
      subnetType: ec2.SubnetType.PUBLIC,
    });

    this.privateSubnets = this.vpc.selectSubnets({
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    });

    this.ecsSecurityGroup = new ec2.SecurityGroup(this, "mySecurityGroup", {
      vpc: this.vpc,
      securityGroupName: props.ecsSecurityGroupName,
      allowAllOutbound: props.allowAllOutbound,
    });

    this.albSecurityGroup = new ec2.SecurityGroup(this, "myalbSecurityGroup", {
      vpc: this.vpc,
      securityGroupName: props.albSecurityGroupName,
      allowAllOutbound: props.allowAllOutbound,
    });

    const vpcInterfaceForECR = new ec2.InterfaceVpcEndpoint(
      this,
      "vpcInterfaceEndpoint",
      {
        service: ec2.InterfaceVpcEndpointAwsService.ECR,
        vpc: this.vpc,
        subnets: this.privateSubnets,
        serviceRegion: props.serviceRegion,
        ipAddressType: props.ipAddressType,
      },
    );

    const vpcInterfaceForDynamoDB = new ec2.InterfaceVpcEndpoint(
      this,
      "vpcInterfaceEndpoint",
      {
        service: ec2.InterfaceVpcEndpointAwsService.DYNAMODB,
        vpc: this.vpc,
        subnets: this.privateSubnets,
        serviceRegion: props.serviceRegion,
        ipAddressType: props.ipAddressType,
      },
    );

    this.ecsSecurityGroup.addIngressRule(this.albSecurityGroup, ec2.Port.tcp(8080));
    this.ecsSecurityGroup.addIngressRule(this.albSecurityGroup, ec2.Port.tcp(443));
    this.ecsSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
  }
}
