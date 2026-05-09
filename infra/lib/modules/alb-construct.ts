import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { IVpc, ISecurityGroup, SubnetType } from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";

export interface ALBConstructProps{
  loadBalancerName?: string;
  vpc: IVpc;
  internetFacing?: boolean;
  albSecurityGroup: ISecurityGroup;
  publicSubnetType: SubnetType
  targetType?: elbv2.TargetType;
  crossZoneEnabled?: boolean;
  ipAddressType?: elbv2.TargetGroupIpAddressType;
  protocol?: cdk.aws_elasticloadbalancingv2.ApplicationProtocol
}

export class ALBConstruct extends Construct {
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly apiTargetGroup: cdk.aws_elasticloadbalancingv2.ApplicationTargetGroup;
  public readonly apiGreenTargetGroup: elbv2.ApplicationTargetGroup;
  public readonly dashboardTargetGroup: cdk.aws_elasticloadbalancingv2.ApplicationTargetGroup;
  public readonly dashboardGreenTargetGroup: cdk.aws_elasticloadbalancingv2.ApplicationTargetGroup;
  public readonly listener: cdk.aws_elasticloadbalancingv2.ApplicationListener;
  public readonly testListener: cdk.aws_elasticloadbalancingv2.ApplicationListener;
  public readonly apiListenerRule: cdk.aws_elasticloadbalancingv2.ApplicationListenerRule;
  public readonly dashboardListenerRule: cdk.aws_elasticloadbalancingv2.ApplicationListenerRule;

  constructor(scope: Construct, id: string, props: ALBConstructProps) {
    super(scope, id);

    this.alb = new elbv2.ApplicationLoadBalancer(this, "ALB", {
      loadBalancerName: props.loadBalancerName,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: props.publicSubnetType,
      },
      internetFacing: props.internetFacing,
      securityGroup: props.albSecurityGroup,
    });

     this.listener = this.alb.addListener("Listener", {
      port: 80,
      protocol: props.protocol,
      defaultAction: elbv2.ListenerAction.fixedResponse(400, {
        contentType: "application/json",
        messageBody: "Bad Requests"
      })
    });

    this.testListener = this.alb.addListener("testListener", {
      port: 8080,
      protocol: props.protocol,
    });

    this.apiTargetGroup = new elbv2.ApplicationTargetGroup(this, "apiTargetGroup", {
      vpc: props.vpc,
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      healthCheck: {
        path: "/healthz",
        interval: cdk.Duration.seconds(30),
      },
      targetType: props.targetType,
      crossZoneEnabled: props.crossZoneEnabled,
      ipAddressType: props.ipAddressType,
    });

    this.apiGreenTargetGroup = new elbv2.ApplicationTargetGroup(this, "apiGreenTargetGroup", {
      vpc: props.vpc,
      port: 8080,
      protocol: props.protocol,
      healthCheck: {
        path: "/healthz",
        interval: cdk.Duration.seconds(30),
      },
      targetType: props.targetType,
      crossZoneEnabled: props.crossZoneEnabled,
      ipAddressType: props.ipAddressType,
    });

    this.dashboardTargetGroup = new elbv2.ApplicationTargetGroup(this, "dashboardTargetGroup", {
      vpc: props.vpc,
      port: 8081,
      protocol: props.protocol,
      healthCheck: {
        path: "/healthz",
        interval: cdk.Duration.seconds(30),
      },
      targetType: props.targetType,
      crossZoneEnabled: props.crossZoneEnabled,
      ipAddressType: props.ipAddressType,
    });

    this.dashboardGreenTargetGroup = new elbv2.ApplicationTargetGroup(this, "dashboardGreenTargetGroup", {
      vpc: props.vpc,
      port: 8081,
      protocol: props.protocol,
      healthCheck: {
        path: "/healthz",
        interval: cdk.Duration.seconds(30),
      },
      targetType: props.targetType,
      crossZoneEnabled: props.crossZoneEnabled,
      ipAddressType: props.ipAddressType,
    });

    this.testListener.addTargetGroups("greenTestTargetGroupAttachments", {
      targetGroups: [this.apiGreenTargetGroup, this.dashboardGreenTargetGroup]
    });

    this.dashboardListenerRule = new elbv2.ApplicationListenerRule(this, "productionDashboardListenerRule", {
      listener: this.listener,
      conditions: [elbv2.ListenerCondition.pathPatterns(["/summary", "/recent", "/top", "/url/*"])],
      action: elbv2.ListenerAction.forward([this.dashboardTargetGroup]),
      priority: 1
    });

    this.apiListenerRule = new elbv2.ApplicationListenerRule(this, "productionApiListenerRule", {
      listener: this.listener,
      conditions: [elbv2.ListenerCondition.pathPatterns(["/*"])],
      action: elbv2.ListenerAction.forward([this.apiTargetGroup]),
      priority: 2
    });
  }
}
