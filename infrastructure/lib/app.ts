#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { TycheStack } from './tyche-stack.js';

const app = new cdk.App();

// Create the main stack
// Stack name and environment can be customized via CDK context or env vars
new TycheStack(app, 'TycheStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: 'Tyche budgeting app - backend infrastructure',
});

app.synth();
