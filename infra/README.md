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

`/link-list` uses the existing `sk-index` and does not require a backfill.
It checks uppercase and lowercase player tags; older mixed-case links may not
be found. The index is eventually consistent, so recent changes may take a
short time to appear.

The previously introduced `normalized-player-tag-index` remains configured to
avoid removing an existing deployed index; `/link-list` does not use it.
