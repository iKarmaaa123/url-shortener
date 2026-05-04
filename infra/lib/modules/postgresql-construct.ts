import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { IVpc, SubnetSelection, ISecurityGroup } from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import { Construct } from "constructs";

export interface Postgresqlprops {
  version: cdk.aws_rds.PostgresEngineVersion;
  instanceType?: cdk.aws_ec2.InstanceType;
  vpc: IVpc;
  privateSubnetType: ec2.SubnetType;
  securityGroups: ISecurityGroup;
  databaseName?: string;
  port?: number;
  allocatedStorage?: number;
  maxAllocatedStorage?: number;
  storageType?: cdk.aws_rds.StorageType;
  storageEncrypted: boolean;
  multiAz?: boolean;
  backupRetention?: cdk.Duration;
  secretName?: string;
  removalPolicy?: cdk.RemovalPolicy
}

export class ProgresqlDatabaseConstruct extends Construct {
  public readonly database: cdk.aws_rds.DatabaseInstance;

  constructor(scope: Construct, id: string, props: Postgresqlprops) {
    super(scope, id);

    this.database = new rds.DatabaseInstance(this, "PostgresDb", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: props.version
      }),
      instanceType: props.instanceType,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: props.privateSubnetType,
      },
      securityGroups: [props.securityGroups],
      databaseName: props.databaseName,
      port: props.port,
      credentials: rds.Credentials.fromGeneratedSecret("postgresqlCredentials", {
          secretName: props.secretName,
      }),
      allocatedStorage: props.allocatedStorage,
      maxAllocatedStorage: props.maxAllocatedStorage,
      storageType: props.storageType,
      storageEncrypted: props.storageEncrypted,
      multiAz: props.multiAz,
      backupRetention: props.backupRetention,
      removalPolicy: props.removalPolicy,
    });
  }
}
