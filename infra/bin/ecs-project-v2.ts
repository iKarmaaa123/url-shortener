#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { EcrStack } from "../lib/ecr-stack";
import { NetworkStack } from "../lib/network-stack";
import { DatabaseStack } from "../lib/database-stack";
import { MessagingStack } from "../lib/messaging-stack";
import { ComputeStack } from "../lib/compute-stack";

const app = new cdk.App();

// ECR Stack - independent, can be deployed separately
const ecrStack = new EcrStack(app, "ecrStack");

// Network Stack - foundational layer
const networkStack = new NetworkStack(app, "networkStack",);

// Messaging Stack - independent of other infrastructure stacks
const messageStack = new MessagingStack(app, "messagingStack");

// Database Stack - depends on Network Stack
const databaseStack = new DatabaseStack(app, "databaseStack", networkStack);
databaseStack.addDependency(networkStack);

// Compute Stack - depends on Network, Database, and Messaging Stacks
const computeStack = new ComputeStack(app, "computeStack", networkStack, databaseStack, messageStack);

computeStack.addDependency(networkStack);
computeStack.addDependency(databaseStack);
computeStack.addDependency(messageStack);
