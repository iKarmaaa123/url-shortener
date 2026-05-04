import { Construct } from "constructs";
import { Duration, Stack } from "aws-cdk-lib"
import * as codedeploy from "aws-cdk-lib/aws-codedeploy"
import  { ITargetGroup, IListenerRef } from  "aws-cdk-lib/aws-elasticloadbalancingv2"
import { IMetric, Alarm } from "aws-cdk-lib/aws-cloudwatch";
import { IBaseService } from "aws-cdk-lib/aws-ecs";

export interface CodeDeployConstructProps {
  apiService: IBaseService;
  dashboardService: IBaseService;
  apiBlueTargetGroup: ITargetGroup;
  apiGreenTargetGroup: ITargetGroup;
  dashboardBlueTargetGroup: ITargetGroup;
  dashboardGreenTargetGroup: ITargetGroup;
  listener: IListenerRef;
  testListener?: IListenerRef;
  terminationWaitTime?: Duration;
  threshold: number;
  evaluationPeriods: number;
  apiTargetGroupmetric: IMetric;
  dashboardTargetGroupmetric: IMetric;
  stoppedDeployment?: boolean;
  failedDeployment?: boolean;
  deploymentInAlarm?: boolean;
}

export class CodeDeployConstruct extends Construct {
    constructor(scope: Construct, id: string, props: CodeDeployConstructProps) {
      super(scope, id)

    const apiGreenUnhealthyHosts = new Alarm(this, "apiGreenUnhealthyHosts", {
        alarmName: Stack.of(this).stackName + '-Api-Unhealthy-Hosts-Green',
        metric: props.apiTargetGroupmetric,
        threshold: props.threshold,
        evaluationPeriods: props.evaluationPeriods,
      });

    const dashboardGreenUnhealthyHosts = new Alarm(this, "dashboardGreenUnhealthyHosts", {
        alarmName: Stack.of(this).stackName + "-Dashboard-Unhealthy-Hosts-Green",
        metric: props.apiTargetGroupmetric,
        threshold: props.threshold,
        evaluationPeriods: props.evaluationPeriods,
      });

      new codedeploy.EcsDeploymentGroup(this, "apiBlueGreenDeploymentGroup", {
        deploymentGroupName: "apiECSBlueGreenDeploymentGroup",
        alarms: [apiGreenUnhealthyHosts],
        autoRollback: {
          stoppedDeployment: props.stoppedDeployment,
          deploymentInAlarm: props.deploymentInAlarm,
          failedDeployment: props.failedDeployment,
        },
        service: props.apiService,
        blueGreenDeploymentConfig: {
          blueTargetGroup: props.apiBlueTargetGroup,
          greenTargetGroup: props.apiGreenTargetGroup,
          listener: props.listener,
          testListener: props.testListener,
          terminationWaitTime: props.terminationWaitTime
        } 
      });

      new codedeploy.EcsDeploymentGroup(this, "dashboardBlueGreenDeploymentGroup", {
        deploymentGroupName: "dashboardECSBlueGreenDeploymentGroup",
        alarms: [dashboardGreenUnhealthyHosts],
        autoRollback: {
          stoppedDeployment: props.stoppedDeployment,
          deploymentInAlarm: props.deploymentInAlarm,
          failedDeployment: props.failedDeployment,
        },
        service: props.dashboardService,
        blueGreenDeploymentConfig: {
          blueTargetGroup: props.dashboardBlueTargetGroup,
          greenTargetGroup: props.dashboardGreenTargetGroup,
          listener: props.listener,
          testListener: props.testListener,
          terminationWaitTime: props.terminationWaitTime
        } 
      });
    }
}