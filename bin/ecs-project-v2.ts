#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { EcsStack } from "../lib/ecs-stack";

const app = new cdk.App();
new EcsStack(app, "ecsStack");
