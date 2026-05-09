import * as cdk from "aws-cdk-lib";
import { TagMutability } from "aws-cdk-lib/aws-ecr";
import { Construct } from "constructs";
import { EcrConstruct } from "./modules/ecr-construct";

export class EcrStack extends cdk.Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new EcrConstruct(this, "ecrApiRepo", {
      repositoryName: "api-repository",
      emptyOnDelete: true,
      imageTagMutability: TagMutability.IMMUTABLE
    });

    new EcrConstruct(this, "ecrWorkerRepo", {
      repositoryName: "worker-repository",
      emptyOnDelete: true,
      imageTagMutability: TagMutability.IMMUTABLE
    });

    new EcrConstruct(this, "ecrDashbaordRepo", {
      repositoryName: "dashboard-repository",
      emptyOnDelete: true,
      imageTagMutability: TagMutability.IMMUTABLE
    });
  }
}
