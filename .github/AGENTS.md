# S3 Proxy CDK — Agent Guide

## Project Overview

An AWS CDK app that deploys an API Gateway REST API backed by a Lambda authorizer and a Lambda handler, proxying S3 object downloads via pre-signed URLs.

## Essential Commands

| Command                 | Description                                      |
| ----------------------- | ------------------------------------------------ |
| `npm run build`         | TypeScript compilation (`tsc`)                   |
| `npm run test`          | Run Jest test suite                              |
| `npm run deploy`        | `cdk deploy` — deploy to AWS                     |
| `npm run synth`         | `cdk synth` — synthesize CloudFormation template |
| `npm run cdk -- <args>` | Pass-through to CDK CLI                          |

## Architecture

See [README.md](../README.md) for full architecture diagram and flow.

```
Client → GET /{bucket}/{path+} → API Gateway
  ├─ Lambda Authorizer (REQUEST) — validates session_id cookie
  └─ Lambda Backend — generates S3 pre-signed URL → 302 redirect
```

## Key Files

| File                         | Purpose                                                           |
| ---------------------------- | ----------------------------------------------------------------- |
| `bin/s3-proxy.ts`            | CDK app entry point                                               |
| `lib/s3-proxy-stack.ts`      | Stack definition (S3 bucket, Lambdas, API Gateway)                |
| `lambda/authorizer/index.ts` | Request authorizer — parses Cookie header for `session_id`        |
| `lambda/backend/index.ts`    | Handler — validates bucket, generates pre-signed URL, returns 302 |
| `test/s3-proxy.test.ts`      | CDK snapshot-style tests                                          |

## Conventions

- **CDK v2** — use `aws-cdk-lib`, not the deprecated `@aws-cdk/*` packages.
- **Lambda runtime** — Node.js 20.x, `NodejsFunction` with esbuild bundling.
- **Module system** — ES2022 / NodeNext (`import`/`export` syntax).
- **Lambda handler signature** — Standard AWS Lambda event types (`aws-lambda` package).
- **S3 SDK v3** — `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`.
- **Testing** — Jest with `ts-jest`; uses `aws-cdk-lib/assertions` (`Template.fromStack`).
- **IAM permissions** — Granted via CDK's `.grant*()` methods, not inline policies.

## Potential Pitfalls

- The deploy requires a **bootstrapped CDK environment** in the target account/region.
- The S3 bucket uses `RemovalPolicy.RETAIN` — it is **not** deleted on stack destruction.
- The authorizer parses `session_id` from the `Cookie` header (case-insensitive fallback to `cookie`).
- Pre-signed URLs expire in **5 minutes** (`expiresIn: 300`).
- Allowed buckets are configured via the `ALLOWED_BUCKETS` env var (comma-separated).
- Lambda bundling errors: if `esbuild` is not installed globally, the CDK uses the project-local copy.
