import { Duration, Stack } from "aws-cdk-lib/core";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { DeploymentControllerType } from "aws-cdk-lib/aws-ecs";
import { EcsConstruct } from "./modules/ecs-construct";
import { ALBConstruct } from "./modules/alb-construct";
import { WafContruct } from "./modules/waf-construct";
import { CodeDeployConstruct } from "./modules/codedeploy-construct";
import { IamConstruct } from "./modules/iam-construct";
import { AppConstants } from "./config/app-constants";
import { AppSettings } from "./config/app-settings";
import { NetworkingStack } from "./networking-stack";
import { DatabaseStack } from "./database-stack";
import { MessagingStack } from "./messaging-stack";


export class ComputeStack extends Stack {
  constructor(scope: Construct, id: string, networkingStack: NetworkingStack, databaseStack: DatabaseStack, messagingStack: MessagingStack) {
    super(scope, id);

    const alb = new ALBConstruct(this, "alb", {
      loadBalancerName: AppConstants.ALB_NAME,
      vpc: networkingStack.vpc,
      publicSubnetType: ec2.SubnetType.PUBLIC,
      internetFacing: true,
      albSecurityGroup: networkingStack.albSecurityGroup,
      targetType: elbv2.TargetType.IP,
      crossZoneEnabled: AppSettings.ENABLE_CROSS_ZONE_LB,
      ipAddressType: elbv2.TargetGroupIpAddressType.IPV4,
      protocol: elbv2.ApplicationProtocol.HTTP
    });

    const iam = new IamConstruct(this, "iam", {
      executionRoleName: AppConstants.ECS_EXECUTION_ROLE_NAME,
      dynamodbTable: databaseStack.dynamoDBTable,
      sqsQueue: messagingStack.sqsQueue 
    });

    const ecs = new EcsConstruct(this, "ecs", {
      clusterName: AppConstants.ECS_CLUSTER_NAME,
      vpc: networkingStack.vpc,
      privateSubnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      region: this.region,
      securityGroups: [networkingStack.ecsSecurityGroup],
      enableFargateCapacityProviders: true,
      desiredCount: AppConstants.ECS_DESIRED_COUNT,
      memoryLimitMiB: AppConstants.ECS_MEMORY_LIMIT_MIB,
      cpu: AppConstants.ECS_CPU,
      dynamodbTable: databaseStack.dynamoDBTable,
      sqsQueue: messagingStack.sqsQueue,
      postgresql: databaseStack.postgresDatabase,
      assignPublicIp: AppSettings.ENABLE_PUBLIC_IP,
      enableExecuteCommand: AppSettings.ENABLE_EXECUTE_COMMAND,
      postgresqlSecret: databaseStack.postgresDatabase.secret,
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
      redisEndpoint: databaseStack.redisEndpoint
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
    });

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
