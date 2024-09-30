#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EKSStack } from '../lib/eks-stack';
import {VpcStack} from '../lib/vpc';

const app = new cdk.App();

const keyName = app.node.tryGetContext("keyName");
if (!keyName) {
    throw new Error("Please provide EC2 keypair name. This is required to build in bastion host");
}
// vpc stack with bastion host
const vpc = new VpcStack(app, 'VpcStack', {
    keyName: keyName,    
});

// eks stack
new EKSStack(app, 'EKSStack', {
    vpc: vpc.vpc,
    ekssecgrp: vpc.ekssecuritygroup,
    role: vpc.BastionHostRole,
});

cdk.Tags.of(app).add('project', 'eks-cdk');
cdk.Tags.of(app).add('owner', 'arun');
cdk.Tags.of(app).add('purpose', 'temporary demo');