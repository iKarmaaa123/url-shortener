import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { IVpc, ISecurityGroup, SubnetSelection } from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";

interface ALBConstructProps extends cdk.StackProps {
  loadBalancerName?: string;
  vpc: IVpc;
  internetFacing?: boolean;
  albSecurityGroup: ISecurityGroup;
  vpcSubnets?: SubnetSelection;
  http_port?: number;
  http_protocol?: elbv2.ApplicationProtocol;
  targetType?: elbv2.TargetType;
  health_check?: elbv2.HealthCheck;
  crossZoneEnabled?: boolean;
  ipAddressType?: elbv2.TargetGroupIpAddressType;
}

export class ALBConstruct extends Construct {
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly apiTargetGroup: cdk.aws_elasticloadbalancingv2.ApplicationTargetGroup;
  public readonly dashboardTargetGroup: cdk.aws_elasticloadbalancingv2.ApplicationTargetGroup;

  constructor(scope: Construct, id: string, props: ALBConstructProps) {
    super(scope, id);

    this.alb = new elbv2.ApplicationLoadBalancer(this, "ALB", {
      loadBalancerName: props.loadBalancerName,
      vpc: props.vpc,
      vpcSubnets: props.vpcSubnets,
      internetFacing: props.internetFacing,
      securityGroup: props.albSecurityGroup,
    });

    this.apiTargetGroup = new elbv2.ApplicationTargetGroup(this, "apiTG", {
      vpc: props.vpc,
      port: props.http_port,
      protocol: props.http_protocol,
      healthCheck: props.health_check,
      targetType: props.targetType,
      crossZoneEnabled: props.crossZoneEnabled,
      ipAddressType: props.ipAddressType,
    });

    this.dashboardTargetGroup = new elbv2.ApplicationTargetGroup(this, "dashboardTG", {
      vpc: props.vpc,
      port: props.http_port,
      protocol: props.http_protocol,
      healthCheck: props.health_check,
      targetType: props.targetType,
      crossZoneEnabled: props.crossZoneEnabled,
      ipAddressType: props.ipAddressType,
    });

    const listener = this.alb.addListener("Listener", {
      port: props.http_port,
      protocol: props.http_protocol,
    });

    listener.addTargetGroups("Targets", {
      targetGroups: [this.apiTargetGroup],
    });

    listener.addTargetGroups("Targets", {
      targetGroups: [this.dashboardTargetGroup],
    });
  }
}
