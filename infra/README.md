# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## Player link index

After deploying the updated bot and infrastructure, wait for the
`normalized-player-tag-index` on `BotTable` to become ACTIVE. Then, from the
repository root, run `node bot\scripts\backfill-link-index.cjs` with AWS
credentials and region configured. The credentials need permission to describe,
scan, update and put items in `BotTable`.

The one-time backfill scans the table and updates existing player links at a
limited rate, so it may take a while and consume provisioned capacity. If it
fails or is interrupted, rerun it; already updated records are skipped.
`/link-list` remains unavailable until the backfill finishes. The index is
eventually consistent, so recent updates may take a short time to appear.
