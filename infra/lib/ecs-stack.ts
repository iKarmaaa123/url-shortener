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
import { IamConstruct } from "./modules/iam-construct";
import * as rds from "aws-cdk-lib/aws-rds";
import { AppConstants } from "./config/app-constants";
import { AppSettings } from "./config/app-settings";

export class EcsStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const vpc = new VpcConstruct(this, "vpc", {
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
      onePerAz: this.availabilityZones.length > 1,
    });

    const dynamoDB = new DynamoDBConstruct(this, "dynamodb", {
      tableName: AppConstants.DYNAMODB_TABLE_NAME,
      partitionKey: { name: AppConstants.DYNAMODB_PARTITION_KEY, type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      pointInTimeRecoveryEnabled: AppSettings.ENABLE_POINT_IN_TIME_RECOVERY,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const sqs = new SqsConstruct(this, "sqs", {
      queueName: AppConstants.SQS_QUEUE_NAME,
      visibilityTimeout: Duration.seconds(AppConstants.SQS_VISIBILITY_TIMEOUT_SECONDS),
      receiveMessageWaitTime: Duration.seconds(AppConstants.SQS_RECEIVE_MESSAGE_WAIT_TIME_SECONDS),
    });

    const postgresqlDatabase = new ProgresqlDatabaseConstruct(this, "postgresDatabase", {
      databaseName: AppConstants.POSTGRES_DATABASE_NAME,
      version: rds.PostgresEngineVersion.VER_18_1,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      port: AppConstants.POSTGRES_PORT,
      vpc: vpc.vpc,
      privateSubnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      multiAz: AppSettings.ENABLE_MULTI_AZ,
      securityGroups: vpc.ecsSecurityGroup,
      allocatedStorage: AppConstants.POSTGRES_ALLOCATED_STORAGE,
      maxAllocatedStorage: AppConstants.POSTGRES_MAX_ALLOCATED_STORAGE,
      storageType: rds.StorageType.GP2,
      storageEncrypted: AppSettings.ENABLE_STORAGE_ENCRYPTION,
      backupRetention: Duration.days(AppConstants.POSTGRES_BACKUP_RETENTION_DAYS),
      secretName: AppConstants.POSTGRES_SECRET_NAME,
      removalPolicy: RemovalPolicy.DESTROY,
    });

     const alb = new ALBConstruct(this, "alb", {
      loadBalancerName: AppConstants.ALB_NAME,
      vpc: vpc.vpc,
      publicSubnetType: ec2.SubnetType.PUBLIC,
      internetFacing: true,
      albSecurityGroup: vpc.albSecurityGroup,
      targetType: elbv2.TargetType.IP,
      crossZoneEnabled: AppSettings.ENABLE_CROSS_ZONE_LB,
      ipAddressType: elbv2.TargetGroupIpAddressType.IPV4,
      protocol: elbv2.ApplicationProtocol.HTTP
    });

    const elasticCacheRedis = new ElastiCacheRedis(this, "elasticCacheRedis", {
      clusterName: AppConstants.ELASTICACHE_CLUSTER_NAME,
      cacheNodeType: AppConstants.ELASTICACHE_NODE_TYPE,
      engine: Engine.redis,
      autoMinorVersionUpgrade: AppSettings.ENABLE_AUTO_MINOR_VERSION_UPGRADE,
      networkType: AppConstants.ELASTICACHE_NETWORK_TYPE,
      vpcSecurityGroupIds: [vpc.ecsSecurityGroup.securityGroupId],
      subnetIds: vpc.vpc.privateSubnets.map(subnets => subnets.subnetId),
      description: AppConstants.ELASTICACHE_DESCRIPTION
    });

    const iam = new IamConstruct(this, "iam", {
      executionRoleName: AppConstants.ECS_EXECUTION_ROLE_NAME,
      dynamodbTable: dynamoDB.dynamoDBTable,
      sqsQueue: sqs.sqsQueue 
    }
    )

    const ecs = new EcsConstruct(this, "ecs", {
      clusterName: AppConstants.ECS_CLUSTER_NAME,
      vpc: vpc.vpc,
      privateSubnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      region: this.region,
      securityGroups: [vpc.ecsSecurityGroup],
      enableFargateCapacityProviders: true,
      desiredCount: AppConstants.ECS_DESIRED_COUNT,
      memoryLimitMiB: AppConstants.ECS_MEMORY_LIMIT_MIB,
      cpu: AppConstants.ECS_CPU,
      dynamodbTable: dynamoDB.dynamoDBTable,
      sqsQueue: sqs.sqsQueue,
      postgresql: postgresqlDatabase.database,
      assignPublicIp: AppSettings.ENABLE_PUBLIC_IP,
      enableExecuteCommand: AppSettings.ENABLE_EXECUTE_COMMAND,
      postgresqlSecret: postgresqlDatabase.database.secret,
      deploymentControllerType: DeploymentControllerType.CODE_DEPLOY,
      alternateTargetGroup: alb.apiGreenTargetGroup,
      imageTag: this.node.tryGetContext("imageTag"),
      apiTargetGroup: alb.apiTargetGroup,
      apiGreenTargetGroup: alb.apiGreenTargetGroup,
      dashboardTargetGroup: alb.dashboardTargetGroup,
      dashboardGreenTargetGroup: alb.dashboardGreenTargetGroup,
      executionRole: iam.executionRole,
      apiTaskRole: iam.apiTaskRole,
      workerTaskRole: iam.workerTaskRole,
      dashboardTaskRole: iam.dashboardTaskRole,
      redisEndpoint: elasticCacheRedis.cacheCluster.attrRedisEndpointAddress + ":" + elasticCacheRedis.cacheCluster.attrRedisEndpointPort
    });

    const codeDeploy = new CodeDeployConstruct(this, "CodeDeploy", {
      apiTargetGroupmetric: alb.apiGreenTargetGroup.metrics.unhealthyHostCount(),
      dashboardTargetGroupmetric: alb.dashboardGreenTargetGroup.metrics.unhealthyHostCount(),
      threshold: AppConstants.CODEDEPLOY_THRESHOLD,
      evaluationPeriods: AppConstants.CODEDEPLOY_EVALUATION_PERIODS,
      apiBlueTargetGroup: alb.apiTargetGroup,
      apiGreenTargetGroup: alb.apiGreenTargetGroup,
      dashboardBlueTargetGroup: alb.dashboardTargetGroup,
      dashboardGreenTargetGroup: alb.dashboardGreenTargetGroup,
      listener: alb.listener,
      testListener: alb.testListener,
      terminationWaitTime: Duration.minutes(AppConstants.CODEDEPLOY_TERMINATION_WAIT_MINUTES),
      apiService: ecs.ecsApiService,
      dashboardService: ecs.ecsDashboardService,
      stoppedDeployment: AppSettings.ENABLE_STOPPED_DEPLOYMENT_NOTIFICATION,
      failedDeployment: AppSettings.ENABLE_FAILED_DEPLOYMENT_NOTIFICATION,
      deploymentInAlarm: AppSettings.ENABLE_DEPLOYMENT_IN_ALARM_NOTIFICATION
    })

    const waf = new WafContruct(this, "waf", {
      responseCode: AppConstants.WAF_RESPONSE_CODE,
      scope: AppConstants.WAF_SCOPE,
      name: AppConstants.WAF_NAME,
      cloudWatchMetricsEnabled: AppSettings.ENABLE_CLOUDWATCH_METRICS,
      metricName: AppConstants.WAF_METRIC_NAME,
      sampledRequestsEnabled: AppSettings.ENABLE_SAMPLED_REQUESTS,
      ruleName: AppConstants.WAF_RULE_NAME,
      priority: AppConstants.WAF_PRIORITY,
      countryCodes: AppConstants.WAF_COUNTRY_CODES,
      resourceArn: alb.alb.loadBalancerArn,
    });
  }
}
