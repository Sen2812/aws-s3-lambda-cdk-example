# S3 Proxy — CDK

API Gateway + Lambda authorizer + S3 pre-signed URL proxy.

An API Gateway endpoint `GET /{bucket}/{path+}` validates a `session_id`
cookie via a Lambda authorizer, then issues a 302 redirect to a
time-limited S3 pre-signed URL so the client downloads the object
directly from S3.

## Architecture

```
Client ──GET /{bucket}/{path+}──▶ API Gateway
                                  │
                                  ├─ Lambda Authorizer (REQUEST)
                                  │   Cookie → session_id → Allow / Deny
                                  │
                                  └─ Lambda Backend
                                      S3 pre-signed URL → 302 redirect
```

## Prerequisites

- Node.js 18+
- AWS credentials configured (`aws configure` or environment variables)
- Bootstrapped CDK environment (`cdk bootstrap` — once per account/region)

## Deploy

```bash
npm install
npm run cdk bootstrap   # first time only, per account+region
npm run deploy
```

After deployment the stack outputs:

- `ApiEndpoint` — base URL of the API
- `BucketName` — the S3 bucket

## Usage

Upload a file to the bucket, then request it through the API:

```bash
curl -v -H "Cookie: session_id=my-session" \
  "https://<api-id>.execute-api.<region>.amazonaws.com/prod/<bucket>/path/to/object"
```

→ HTTP 302 with `Location` set to the S3 pre-signed URL (valid 5 minutes).

Without the `session_id` cookie the request is denied (HTTP 403).

## Cleanup

```bash
npm run cdk destroy
```

> The S3 bucket is retained (`RemovalPolicy.RETAIN`). Delete it manually
> if no longer needed.

## Project layout

```
bin/s3-proxy.ts              CDK app entry
lib/s3-proxy-stack.ts        Stack: S3 + API Gateway + Lambdas
lambda/authorizer/index.ts   Cookie → session_id → Allow/Deny
lambda/backend/index.ts      Path params → pre-signed URL → 302
```
