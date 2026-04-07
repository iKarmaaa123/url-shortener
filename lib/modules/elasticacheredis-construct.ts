import { CfnCacheCluster, CfnSubnetGroup } from "aws-cdk-lib/aws-elasticache";
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
  cacheSubnetGroupName?: string;
  vpcSecurityGroupIds: string[];
}

export class ElastiCacheRedis extends Construct {
  constructor(scope: Construct, id: string, props: ElastiCacheRedisProps) {
    super(scope, id);

    new CfnCacheCluster(this, "elasticCacheCluster", {
      clusterName: props.clusterName,
      cacheNodeType: props.cacheNodeType,
      engine: props.engine,
      numCacheNodes: props.engine === Engine.redis ? 1 : 0,
      autoMinorVersionUpgrade: props.autoMinorVersionUpgrade,
      networkType: props.networkType,
      cacheSubnetGroupName: props.cacheSubnetGroupName,
      vpcSecurityGroupIds: props.vpcSecurityGroupIds,
    });
  }
}
