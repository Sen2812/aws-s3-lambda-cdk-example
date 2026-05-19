import { App } from "aws-cdk-lib/core";
import { Template } from "aws-cdk-lib/assertions";
import { S3ProxyStack } from "../lib/s3-proxy-stack";

/** Create a stack instance for testing. */
function createStack(): { stack: S3ProxyStack; template: Template } {
  const app = new App();
  const stack = new S3ProxyStack(app, "TestStack");
  return { stack, template: Template.fromStack(stack) };
}

test("S3 Bucket Created", () => {
  const { template } = createStack();

  template.resourceCountIs("AWS::S3::Bucket", 1);
  template.hasResourceProperties("AWS::S3::Bucket", {
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
  });
});

test("Lambda Functions Created", () => {
  const { template } = createStack();
  template.resourceCountIs("AWS::Lambda::Function", 2);
});

test("API Gateway Created", () => {
  const { template } = createStack();
  template.resourceCountIs("AWS::ApiGateway::RestApi", 1);
});
