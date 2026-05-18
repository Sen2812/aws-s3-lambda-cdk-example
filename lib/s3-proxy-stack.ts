import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export class S3ProxyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ──────────────────────────────────────────
    // S3 bucket — the file store
    // ──────────────────────────────────────────
    const fileBucket = new s3.Bucket(this, 'FileBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // keep on stack delete
    });

    // ──────────────────────────────────────────
    // Lambda: backend — generates pre-signed URL & returns 302
    // ──────────────────────────────────────────
    const backendLambda = new nodejs.NodejsFunction(this, 'BackendLambda', {
      entry: 'lambda/backend/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: {
        ALLOWED_BUCKETS: fileBucket.bucketName,
      },
      bundling: {
        // esbuild bundles @aws-sdk/* so no Lambda layer needed
        minify: false,
        sourceMap: true,
      },
    });

    // Grant the backend Lambda permission to read objects (allows
    // existence checks before generating pre-signed URLs, though not
    // strictly required for getSignedUrl itself).
    fileBucket.grantRead(backendLambda);

    // ──────────────────────────────────────────
    // Lambda: authorizer — validates session_id cookie
    // ──────────────────────────────────────────
    const authorizerLambda = new nodejs.NodejsFunction(this, 'AuthorizerLambda', {
      entry: 'lambda/authorizer/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(5),
      memorySize: 256,
      bundling: {
        externalModules: [],
        minify: false,
        sourceMap: true,
      },
    });

    // ──────────────────────────────────────────
    // API Gateway REST API
    // ──────────────────────────────────────────
    const api = new apigateway.RestApi(this, 'S3ProxyApi', {
      restApiName: 'S3 Proxy',
      description: 'Proxies S3 object downloads through pre-signed URLs',
      deployOptions: {
        stageName: 'prod',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // Request-based Lambda authorizer — gives access to headers (Cookie)
    const authorizer = new apigateway.RequestAuthorizer(this, 'CookieAuthorizer', {
      handler: authorizerLambda,
      identitySources: [
        apigateway.IdentitySource.header('Cookie'),
      ],
      resultsCacheTtl: cdk.Duration.minutes(5),
    });

    // ──────────────────────────────────────────
    // Routes: /{bucket}/{path+}
    // ──────────────────────────────────────────
    // Top-level resource: {bucket}
    const bucketResource = api.root.addResource('{bucket}');
    // Proxy resource under it: {path+}  (catch-all for any S3 key)
    const pathResource = bucketResource.addResource('{path+}');

    // GET method with authorizer + Lambda backend
    pathResource.addMethod('GET', new apigateway.LambdaIntegration(backendLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      requestParameters: {
        'method.request.path.bucket': true,
        'method.request.path.path': true,
      },
    });

    // ──────────────────────────────────────────
    // Outputs
    // ──────────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'Base URL of the S3 proxy API',
    });
    new cdk.CfnOutput(this, 'BucketName', {
      value: fileBucket.bucketName,
      description: 'S3 bucket name',
    });
  }
}
