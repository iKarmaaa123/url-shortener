import { RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ecr from "aws-cdk-lib/aws-ecr";

export interface EcrConstructProps {
  repositoryName: string;
  emptyOnDelete: boolean;
}

export class EcrConstruct extends Construct {
  constructor(scope: Construct, id: string, props: EcrConstructProps) {
    super(scope, id);

    new ecr.Repository(this, "apiEcrRepo", {
      repositoryName: props.repositoryName,
      emptyOnDelete: props.emptyOnDelete,
      removalPolicy: props.emptyOnDelete ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
    });
  }
}
