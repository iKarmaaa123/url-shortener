import { RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Repository, TagMutability } from "aws-cdk-lib/aws-ecr";

export interface EcrConstructProps {
  repositoryName?: string;
  emptyOnDelete?: boolean;
  imageTagMutability?: TagMutability
}

export class EcrConstruct extends Construct {
  constructor(scope: Construct, id: string, props: EcrConstructProps) {
    super(scope, id);

    new Repository(this, "apiEcrRepo", {
      repositoryName: props.repositoryName,
      emptyOnDelete: props.emptyOnDelete,
      removalPolicy: props.emptyOnDelete ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
      imageTagMutability: props.imageTagMutability
    });
  }
}
