import { CfnCacheCluster, CfnSubnetGroup } from "aws-cdk-lib/aws-elasticache";
import { ISubnetRef } from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export enum Engine {
  redis = "redis",
  memcached = "memcached",
  valkey = "valkey",
}

export interface ElastiCacheRedisProps {
  clusterName?: string;
  cacheNodeType: string;
  engine: Engine;
  autoMinorVersionUpgrade: boolean;
  networkType?: string;
  vpcSecurityGroupIds: string[];
  subnetIds: (string | ISubnetRef)[];
  description: string;
}

export class ElastiCacheRedis extends Construct {
  constructor(scope: Construct, id: string, props: ElastiCacheRedisProps) {
    super(scope, id);

    const subnetGroup = new CfnSubnetGroup(this, `elasticCacheSubnetGroup`, {
      description: props.description,
      subnetIds: props.subnetIds
    });

    new CfnCacheCluster(this, "elasticCacheCluster", {
      clusterName: props.clusterName,
      cacheNodeType: props.cacheNodeType,
      engine: props.engine,
      numCacheNodes: props.engine === Engine.redis ? 1 : 0,
      autoMinorVersionUpgrade: props.autoMinorVersionUpgrade,
      networkType: props.networkType,
      cacheSubnetGroupName: subnetGroup.ref,
      vpcSecurityGroupIds: props.vpcSecurityGroupIds,
    });
  }
}
