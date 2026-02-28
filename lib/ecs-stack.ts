import { Stack } from "aws-cdk-lib/core";
import { Construct } from "constructs";
import { EcsConstruct } from "./modules/ecs-construct";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { VpcConstruct } from "./modules/vpc-construct";
import { DynamoDBConstruct } from "./modules/dynamodb-construct";

export class EcsStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const ecsVpc = new VpcConstruct(this, "vpc", {
      vpcName: "ecs-vpc",
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "ecs-plublic-subnet",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
      availabilityZones: ["us-east-1a", "us-east-1b"],
      createInternetGateway: true,
      ecsSecurityGroupName: "ecs-security-group",
      allowAllOutbound: true,
      natGateways: 0,
    });

    const dynamodbTable = new DynamoDBConstruct(this, "dynamodb", {
      tableName: "url-shortener-table",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
    });

    new EcsConstruct(this, "ecs", {
      clusterName: "my-ecs-v2-project",
      vpc: ecsVpc.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      securityGroups: [ecsVpc.securityGroup],
      enableFargateCapacityProviders: true,
      executionRoleName: "ecs-url-shortener-execution-role",
      taskRoleName: "ecs-url-shortener-task-role",
      serviceName: "url-shortener-ecs-service",
      desiredCount: 2,
      memoryLimitMiB: 512,
      cpu: 256,
      image: ecs.ContainerImage.fromRegistry(
        "648767092427.dkr.ecr.us-east-1.amazonaws.com/url-shortener:latest",
      ),
      actions: ["*"],
      resources: [dynamodbTable.dynamoDBTable.tableArn],
      environment: {
        TABLE_NAME: "url-shortener-table",
      },
      portMappings: [
        {
          containerPort: 8080,
        },
      ],
    });
  }
}
