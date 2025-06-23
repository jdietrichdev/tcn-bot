import { Stack, StackProps } from "aws-cdk-lib";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { Nextjs } from "cdk-nextjs-standalone";

interface UIStackProps extends StackProps {
  transcriptBucket: Bucket;
}

export class UIStack extends Stack {
  readonly nextjs: Nextjs;

  constructor(scope: Construct, id: string, props: UIStackProps) {
    super(scope, id, props);

    this.nextjs = new Nextjs(this, "bot-ui", {
      nextjsPath: "../ui/",
    });

    props.transcriptBucket.grantRead(this.nextjs.serverFunction.lambdaFunction);
  }
}
