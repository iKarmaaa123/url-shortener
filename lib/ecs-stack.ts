import * as cdk from "aws-cdk-lib";
import { Stack } from "aws-cdk-lib/core";
import { Construct } from "constructs";
import { EcsConstruct } from "./modules/ecs-construct";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { VpcConstruct } from "./modules/vpc-construct";
import { DynamoDBConstruct } from "./modules/dynamodb-construct";
import { ALBConstruct } from "./modules/alb-construct";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { WafContruct } from "./modules/waf-construct";

export class EcsStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const ecsVpc = new VpcConstruct(this, "vpc", {
      vpcName: "ecs-vpc",
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "ecs-public-subnets",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "ecs-private-subnets",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
      availabilityZones: ["us-east-1a", "us-east-1b"],
      createInternetGateway: true,
      ecsSecurityGroupName: "ecs-security-group",
      albSecurityGroupName: "alb-security-group",
      allowAllOutbound: true,
      natGateways: 0,
      serviceRegion: "us-east-1",
      ipAddressType: ec2.VpcEndpointIpAddressType.IPV4,
      privateDnsEnabled: true,
      vpcInterfaceEndpointServiceECR: ec2.InterfaceVpcEndpointAwsService.ECR,
      vpcInterfaceEndpointServiceECRDocker: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
      vpcInterfaceEndpointServiceCloudWatch: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      vpcGatewayEndpointServiceDynamodb: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
      vpcGatewayEndpointServiceS3: ec2.GatewayVpcEndpointAwsService.S3
    });

    const dynamodbConstruct = new DynamoDBConstruct(this, "dynamodb", {
      tableName: "url-shortener-table",
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
    });

    const ecsConstruct = new EcsConstruct(this, "ecs", {
      clusterName: "my-ecsv2-cluster",
      vpc: ecsVpc.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [ecsVpc.ecsSecurityGroup],
      enableFargateCapacityProviders: true,
      executionRoleName: "ecsv2-url-shortener-execution-role",
      taskRoleName: "ecsv2-url-shortener-task-role",
      serviceName: "url-shortener-ecsv2-service",
      desiredCount: 2,
      memoryLimitMiB: 512,
      cpu: 256,
      image: ecs.ContainerImage.fromRegistry(
        "648767092427.dkr.ecr.us-east-1.amazonaws.com/url-shortener:latest",
      ),
      actions: ["*"],
      resources: [dynamodbConstruct.dynamoDBTable.tableArn],
      environment: {
        TABLE_NAME: "url-shortener-table",
        AWS_REGION: "us-east-1",
      },
      portMappings: [
        {
          containerPort: 8080,
        },
      ],
      assignPublicIp: false,
      enableExecuteCommand: true
    });

    const albConstruct = new ALBConstruct(this, "alb", {
      loadBalancerName: "ecsv2-loadbalncer",
      vpc: ecsVpc.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      internetFacing: true,
      albSecurityGroup: ecsVpc.albSecurityGroup,
      health_check: {
        path: "/healthz",
        interval: cdk.Duration.seconds(30),
      },
      targetType: elbv2.TargetType.IP,
      crossZoneEnabled: true,
      ipAddressType: elbv2.TargetGroupIpAddressType.IPV4,
      http_port: 80,
      http_protocol: elbv2.ApplicationProtocol.HTTP,
    });

    ecsConstruct.ecsService.attachToApplicationTargetGroup(albConstruct.targetGroup)

    new WafContruct(this, "waf", {
      block: {
        customResponse: {
          responseCode: 403,
        },
      },
      scope: "REGIONAL",
      name: "ecsWaf",
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "wafMetric",
        sampledRequestsEnabled: true,
      },
      ruleName: "ecsWafRule",
      priority: 0,
      action: {
        allow: {},
      },
      statement: {
        geoMatchStatement: {
          countryCodes: ["US", "GB"],
        },
      },
      resourceArn: albConstruct.alb.loadBalancerArn
    });
  }
}
