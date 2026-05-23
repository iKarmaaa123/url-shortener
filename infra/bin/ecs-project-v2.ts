#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { EcrStack } from "../lib/ecr-stack";
import { NetworkingStack } from "../lib/networking-stack";
import { DatabaseStack } from "../lib/database-stack";
import { MessagingStack } from "../lib/messaging-stack";
import { ComputeStack } from "../lib/compute-stack";

const app = new cdk.App();

const ecrStack = new EcrStack(app, "ecrStack");

const networkingStack = new NetworkingStack(app, "networkStack",);

const messagingStack = new MessagingStack(app, "messagingStack");

const databaseStack = new DatabaseStack(app, "databaseStack", networkingStack);
databaseStack.addDependency(networkingStack);

const computeStack = new ComputeStack(app, "computeStack", networkingStack, databaseStack, messagingStack);
computeStack.addDependency(networkingStack);
computeStack.addDependency(databaseStack);
computeStack.addDependency(messagingStack);
