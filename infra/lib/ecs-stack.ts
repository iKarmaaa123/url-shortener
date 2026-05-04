import { Duration, RemovalPolicy } from "aws-cdk-lib/core";
import { Stack } from "aws-cdk-lib/core";
import { Construct } from "constructs";
import { EcsConstruct } from "./modules/ecs-construct";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { DeploymentControllerType, DeploymentStrategy, ListenerRuleConfiguration} from "aws-cdk-lib/aws-ecs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { VpcConstruct } from "./modules/vpc-construct";
import { DynamoDBConstruct } from "./modules/dynamodb-construct";
import { ALBConstruct } from "./modules/alb-construct";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { WafContruct } from "./modules/waf-construct";
import { SqsConstruct } from "./modules/sqs-construct";
import { ProgresqlDatabaseConstruct } from "./modules/postgresql-construct";
import { ElastiCacheRedis, Engine } from "./modules/elasticacheredis-construct";
import { CodeDeployConstruct } from "./modules/codedeploy-construct";
import * as rds from "aws-cdk-lib/aws-rds";

export class EcsStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const vpc = new VpcConstruct(this, "vpc", {
      vpcName: "ecs-vpc",
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      cidrMask: 24,
      publicSubnetName: "ecsPublicSubnets",
      privateSubnetName: "ecsPrivateSubnets",    
      publicSubnetType: ec2.SubnetType.PUBLIC,
      privateSubnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      description: "Group of private subnets",
      availabilityZones: ["us-east-1a", "us-east-1b", "us-east-1c"],
      createInternetGateway: true,
      ecsSecurityGroupName: "ecs-security-group",
      albSecurityGroupName: "alb-security-group",
      allowAllOutbound: true,
      natGateways: 0,
      serviceRegion: this.region,
      ipAddressType: ec2.VpcEndpointIpAddressType.IPV4,
      privateDnsEnabled: true,
      onePerAz: this.availabilityZones.length > 1,
    });

    const dynamoDB = new DynamoDBConstruct(this, "dynamodb", {
      tableName: "url-shortener-table",
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      pointInTimeRecoveryEnabled: true,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const sqs = new SqsConstruct(this, "sqs", {
      queueName: "ecsV2EcsProjectSqsQueue",
      visibilityTimeout: Duration.seconds(10),
      receiveMessageWaitTime: Duration.seconds(20),
    });

    const postgresqlDatabase = new ProgresqlDatabaseConstruct(this, "postgresDatabase", {
      databaseName: "postgresqlDatabase",
      version: rds.PostgresEngineVersion.VER_18_1,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      port: 5432,
      vpc: vpc.vpc,
      privateSubnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      multiAz: false,
      securityGroups: vpc.ecsSecurityGroup,
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      storageType: rds.StorageType.GP2,
      storageEncrypted: true,
      backupRetention: Duration.days(0),
      secretName: "postgresql-secret",
      removalPolicy: RemovalPolicy.DESTROY,
    });

     const alb = new ALBConstruct(this, "alb", {
      loadBalancerName: "ecsv2-loadbalncer",
      vpc: vpc.vpc,
      publicSubnetType: ec2.SubnetType.PUBLIC,
      internetFacing: true,
      albSecurityGroup: vpc.albSecurityGroup,
      targetType: elbv2.TargetType.IP,
      crossZoneEnabled: true,
      ipAddressType: elbv2.TargetGroupIpAddressType.IPV4,
      protocol: elbv2.ApplicationProtocol.HTTP
    });

    const ecs = new EcsConstruct(this, "ecs", {
      clusterName: "my-ecsv2-cluster",
      vpc: vpc.vpc,
      privateSubnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      region: this.region,
      securityGroups: [vpc.ecsSecurityGroup],
      enableFargateCapacityProviders: true,
      executionRoleName: "ecsv2-url-shortener-execution-role",
      desiredCount: 2,
      memoryLimitMiB: 512,
      cpu: 256,
      dynamodbTable: dynamoDB.dynamoDBTable,
      sqsQueue: sqs.sqsQueue,
      postgresql: postgresqlDatabase.database,
      assignPublicIp: false,
      enableExecuteCommand: true,
      postgresqlSecret: postgresqlDatabase.database.secret,
      deploymentControllerType: DeploymentControllerType.CODE_DEPLOY,
      alternateTargetGroup: alb.apiGreenTargetGroup,
    });

    ecs.ecsApiService.attachToApplicationTargetGroup(
      alb.apiTargetGroup,
    );

    ecs.ecsApiService.attachToApplicationTargetGroup(
      alb.apiGreenTargetGroup,
    );

    ecs.ecsDashboardService.attachToApplicationTargetGroup(
      alb.dashboardTargetGroup,
    );

    ecs.ecsDashboardService.attachToApplicationTargetGroup(
      alb.dashboardGreenTargetGroup,
    );

    new CodeDeployConstruct(this, "CodeDeploy", {
      apiTargetGroupmetric: alb.apiGreenTargetGroup.metrics.unhealthyHostCount(),
      dashboardTargetGroupmetric: alb.dashboardGreenTargetGroup.metrics.unhealthyHostCount(),
      threshold: 1,
      evaluationPeriods: 2,
      apiBlueTargetGroup: alb.apiTargetGroup,
      apiGreenTargetGroup: alb.apiGreenTargetGroup,
      dashboardBlueTargetGroup: alb.dashboardTargetGroup,
      dashboardGreenTargetGroup: alb.dashboardGreenTargetGroup,
      listener: alb.listener,
      testListener: alb.testListener,
      terminationWaitTime: Duration.minutes(5),
      apiService: ecs.ecsApiService,
      dashboardService: ecs.ecsDashboardService,
      stoppedDeployment: true,
      failedDeployment: true,
      deploymentInAlarm: true
    })

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
      resourceArn: alb.alb.loadBalancerArn,
    });

    const elasticCacheRedis = new ElastiCacheRedis(this, "elasticCacheRedis", {
      clusterName: "elasticCacheRedis",
      cacheNodeType: "cache.t4g.micro",
      engine: Engine.redis,
      autoMinorVersionUpgrade: true,
      networkType: "ipv4",
      vpcSecurityGroupIds: [vpc.ecsSecurityGroup.securityGroupId],
      subnetIds: vpc.vpc.privateSubnets,
      description: "List of subnets used for elastic cache redis"
    });
  }
}
