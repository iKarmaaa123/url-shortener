import * as cdk from "aws-cdk-lib";
import { Stack } from "aws-cdk-lib"
import { TagMutability } from "aws-cdk-lib/aws-ecr";
import { Construct } from "constructs";
import { EcrConstruct } from "./modules/ecr-construct";
import { AppConstants } from "./config/app-constants";
import { AppSettings } from "./config/app-settings";

export class EcrStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new EcrConstruct(this, "ecrApiRepo", {
      repositoryName: AppConstants.ECR_API_REPO_NAME,
      emptyOnDelete: AppSettings.EMPTY_ECR_ON_DELETE,
      imageTagMutability: TagMutability.IMMUTABLE
    });

    new EcrConstruct(this, "ecrWorkerRepo", {
      repositoryName: AppConstants.ECR_WORKER_REPO_NAME,
      emptyOnDelete: AppSettings.EMPTY_ECR_ON_DELETE,
      imageTagMutability: TagMutability.IMMUTABLE
    });

    new EcrConstruct(this, "ecrDashbaordRepo", {
      repositoryName: AppConstants.ECR_DASHBOARD_REPO_NAME,
      emptyOnDelete: AppSettings.EMPTY_ECR_ON_DELETE,
      imageTagMutability: TagMutability.IMMUTABLE
    });
  }
}
