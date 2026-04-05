import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";

export interface VpcConstructProps {
  vpcName?: string;
  ipAddresses?: ec2.IIpAddresses;
  availabilityZones?: string[];
  subnetConfiguration?: ec2.SubnetConfiguration[];
  createInternetGateway?: boolean;
  ecsSecurityGroupName?: string;
  albSecurityGroupName?: string;
  natGateways?: number;
  allowAllOutbound?: boolean;
  mapPublicIpOnLaunch?: boolean;
  serviceRegion?: string;
  ipAddressType?: ec2.VpcEndpointIpAddressType;
  privateDnsEnabled?: boolean;
  privateDnsOnlyForInboundResolverEndpoint?: ec2.VpcEndpointPrivateDnsOnlyForInboundResolverEndpoint;
}

export class VpcConstruct extends Construct {
  public readonly vpc: ec2.IVpc;
  public readonly ecsSecurityGroup: ec2.ISecurityGroup;
  public readonly albSecurityGroup: ec2.ISecurityGroup;
  public readonly publicSubnets: ec2.SubnetSelection;
  public readonly privateSubnets: ec2.SubnetSelection;

  constructor(scope: Construct, id: string, props: VpcConstructProps) {
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
      subnetGroupName: "ecsPrivateSubnets",
    });

    this.privateSubnets = this.vpc.selectSubnets({
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      subnetGroupName: "ecsPrivateSubnets"
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

    this.vpc.addInterfaceEndpoint("ecrDockerVpcInterfaceEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
      subnets: this.privateSubnets,
      serviceRegion: props.serviceRegion,
      ipAddressType: props.ipAddressType,
      privateDnsEnabled: props.privateDnsEnabled,
      privateDnsOnlyForInboundResolverEndpoint:
        props.privateDnsOnlyForInboundResolverEndpoint,
    });

    this.vpc.addInterfaceEndpoint("ecrVpcInterfaceEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.ECR,
      subnets: this.privateSubnets,
      serviceRegion: props.serviceRegion,
      ipAddressType: props.ipAddressType,
      privateDnsEnabled: props.privateDnsEnabled,
      privateDnsOnlyForInboundResolverEndpoint:
        props.privateDnsOnlyForInboundResolverEndpoint,
    });

    this.vpc.addInterfaceEndpoint("cloudWatchVpcInterfaceEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      subnets: this.privateSubnets,
      serviceRegion: props.serviceRegion,
      ipAddressType: props.ipAddressType,
      privateDnsEnabled: props.privateDnsEnabled,
      privateDnsOnlyForInboundResolverEndpoint:
        props.privateDnsOnlyForInboundResolverEndpoint,
    });

    this.vpc.addInterfaceEndpoint("sqsVpcInterfaceEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.SQS,
      subnets: this.privateSubnets,
      serviceRegion: props.serviceRegion,
      ipAddressType: props.ipAddressType,
      privateDnsEnabled: props.privateDnsEnabled,
      privateDnsOnlyForInboundResolverEndpoint:
        props.privateDnsOnlyForInboundResolverEndpoint,
    });

    this.vpc.addInterfaceEndpoint("postgresqlVpcInterfaceEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.RDS,
      subnets: this.privateSubnets,
      serviceRegion: props.serviceRegion,
      ipAddressType: props.ipAddressType,
      privateDnsEnabled: props.privateDnsEnabled,
      privateDnsOnlyForInboundResolverEndpoint:
        props.privateDnsOnlyForInboundResolverEndpoint,
    });

    this.vpc.addGatewayEndpoint("dynmaodbVpcGatewayEndpoint", {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
      subnets: [this.privateSubnets],
    });

    this.vpc.addGatewayEndpoint("s3VpcGatewayEndpoint", {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [this.privateSubnets],
    });

    this.ecsSecurityGroup.addIngressRule(this.albSecurityGroup, ec2.Port.tcp(8080));
    this.ecsSecurityGroup.addIngressRule(this.albSecurityGroup, ec2.Port.tcp(8081));
    this.ecsSecurityGroup.addIngressRule(this.albSecurityGroup,ec2.Port.tcp(443));
    this.albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
  }
}
