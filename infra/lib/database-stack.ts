import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib/core";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import { ITableV2, Billing, AttributeType } from "aws-cdk-lib/aws-dynamodb";
import { DynamoDBConstruct } from "./modules/dynamodb-construct";
import { ProgresqlDatabaseConstruct } from "./modules/postgresql-construct";
import { ElastiCacheRedis, Engine } from "./modules/elasticacheredis-construct";
import { AppConstants } from "./config/app-constants";
import { AppSettings } from "./config/app-settings";
import { NetworkingStack } from "./networking-stack";

export class DatabaseStack extends Stack {
  public readonly dynamoDBTable: ITableV2;
  public readonly postgresDatabase: rds.DatabaseInstance;
  public readonly redisEndpoint: string;

  constructor(scope: Construct, id: string, networkingStack: NetworkingStack) {
    super(scope, id);

    const dynamoDB = new DynamoDBConstruct(this, "dynamodb", {
      tableName: AppConstants.DYNAMODB_TABLE_NAME,
      partitionKey: { name: AppConstants.DYNAMODB_PARTITION_KEY, type: AttributeType.STRING },
      billing: Billing.onDemand(),
      pointInTimeRecoveryEnabled: AppSettings.ENABLE_POINT_IN_TIME_RECOVERY,
      removalPolicy: RemovalPolicy.DESTROY
    });

    this.dynamoDBTable = dynamoDB.dynamoDBTable;

    const postgresqlDatabase = new ProgresqlDatabaseConstruct(this, "postgresDatabase", {
      databaseName: AppConstants.POSTGRES_DATABASE_NAME,
      version: rds.PostgresEngineVersion.VER_18_1,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      port: AppConstants.POSTGRES_PORT,
      vpc: networkingStack.vpc,
      privateSubnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      multiAz: AppSettings.ENABLE_MULTI_AZ,
      securityGroups: networkingStack.ecsSecurityGroup,
      allocatedStorage: AppConstants.POSTGRES_ALLOCATED_STORAGE,
      maxAllocatedStorage: AppConstants.POSTGRES_MAX_ALLOCATED_STORAGE,
      storageType: rds.StorageType.GP2,
      storageEncrypted: AppSettings.ENABLE_STORAGE_ENCRYPTION,
      backupRetention: Duration.days(AppConstants.POSTGRES_BACKUP_RETENTION_DAYS),
      secretName: AppConstants.POSTGRES_SECRET_NAME,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.postgresDatabase = postgresqlDatabase.database;

    const elasticCacheRedis = new ElastiCacheRedis(this, "elasticCacheRedis", {
      clusterName: AppConstants.ELASTICACHE_CLUSTER_NAME,
      cacheNodeType: AppConstants.ELASTICACHE_NODE_TYPE,
      engine: Engine.redis,
      autoMinorVersionUpgrade: AppSettings.ENABLE_AUTO_MINOR_VERSION_UPGRADE,
      networkType: AppConstants.ELASTICACHE_NETWORK_TYPE,
      vpcSecurityGroupIds: [networkingStack.ecsSecurityGroup.securityGroupId],
      subnetIds: networkingStack.vpc.privateSubnets.map(subnets => subnets.subnetId),
      description: AppConstants.ELASTICACHE_DESCRIPTION
    });

    this.redisEndpoint = elasticCacheRedis.cacheCluster.attrRedisEndpointAddress + ":" + elasticCacheRedis.cacheCluster.attrRedisEndpointPort;
  }
}
