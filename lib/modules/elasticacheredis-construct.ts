import { CfnCacheCluster, CfnSubnetGroup } from "aws-cdk-lib/aws-elasticache";
import { IVpc, SubnetType } from "aws-cdk-lib/aws-ec2"
import { Construct } from "constructs";

export interface ElastiCacheRedisProps {
    clusterName?: string;
    cacheNodeType: string;
    engine: string;
    numCacheNodes: number;
    autoMinorVersionUpgrade: boolean;
    networkType?: string;
    cacheSubnetGroupName: string;
    vpcSecurityGroupIds: string[];
}

export class ElastiCacheRedis extends Construct {
  constructor(scope: Construct, id: string, props: ElastiCacheRedisProps) {
    super(scope, id)

    new CfnCacheCluster(this, "elasticCacheCluster", {
      clusterName: props.clusterName,
      cacheNodeType: props.cacheNodeType,
      engine: props.engine,
      numCacheNodes: props.numCacheNodes,
      autoMinorVersionUpgrade: props.autoMinorVersionUpgrade,
      networkType: props.networkType,
      cacheSubnetGroupName: props.cacheSubnetGroupName,
      vpcSecurityGroupIds: props.vpcSecurityGroupIds,
    })
  }
}