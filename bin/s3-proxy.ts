#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { S3ProxyStack } from '../lib/s3-proxy-stack';

const app = new cdk.App();
new S3ProxyStack(app, 'S3ProxyStack', {
  // Default env uses the current AWS credentials / region.
  // Override with:  cdk deploy --profile my-profile
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
});
