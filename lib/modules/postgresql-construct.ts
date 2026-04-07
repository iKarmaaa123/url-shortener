import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { IVpc, SubnetSelection, ISecurityGroup } from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import { Construct } from "constructs";

export interface Postgresqlprops {
  vpc: IVpc;
  vpcSubnets: SubnetSelection;
  securityGroups: ISecurityGroup;
  databaseName?: string;
  allocatedStorage?: number;
  maxAllocatedStorage?: number;
  storageType?: cdk.aws_rds.StorageType;
  storageEncrypted: boolean;
  multiAz?: boolean;
  backupRetention?: cdk.Duration;
  monitoringInterval?: cdk.Duration;
  secretName?: string;
}

export class ProgresqlDatabaseConstruct extends Construct {
  public readonly database: cdk.aws_rds.DatabaseInstance;

  constructor(scope: Construct, id: string, props: Postgresqlprops) {
    super(scope, id);

    this.database = new rds.DatabaseInstance(this, "PostgresDb", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_18_1,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MEDIUM,
      ),
      vpc: props.vpc,
      vpcSubnets: props.vpcSubnets,
      securityGroups: [props.securityGroups],
      databaseName: props.databaseName,
      port: 8081,
      credentials: rds.Credentials.fromGeneratedSecret(
        "postgresqlCredentials",
        {
          secretName: props.secretName,
        },
      ),
      allocatedStorage: props.allocatedStorage,
      maxAllocatedStorage: props.maxAllocatedStorage,
      storageType: props.storageType,
      storageEncrypted: props.storageEncrypted,
      multiAz: props.multiAz,
      backupRetention: props.backupRetention,
      monitoringInterval: props.monitoringInterval,
    });
  }
}
