import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import * as S3Proxy from '../lib/s3-proxy-stack';

test('S3 Bucket Created', () => {
  const app = new cdk.App();
  const stack = new S3Proxy.S3ProxyStack(app, 'MyTestStack');
  const template = Template.fromStack(stack);

  template.resourceCountIs('AWS::S3::Bucket', 1);
  template.hasResourceProperties('AWS::S3::Bucket', {
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
  });
});

test('Lambda Functions Created', () => {
  const app = new cdk.App();
  const stack = new S3Proxy.S3ProxyStack(app, 'MyTestStack');
  const template = Template.fromStack(stack);

  template.resourceCountIs('AWS::Lambda::Function', 2);
});

test('API Gateway Created', () => {
  const app = new cdk.App();
  const stack = new S3Proxy.S3ProxyStack(app, 'MyTestStack');
  const template = Template.fromStack(stack);

  template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
});
