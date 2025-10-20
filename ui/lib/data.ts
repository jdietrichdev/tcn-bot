import { s3Client } from "@/app/clients/s3Client";
import { PutObjectCommand } from "@aws-sdk/client-s3";

export const storeRoster = async (roster: File, server: string) => {
  try {
    const buffer = Buffer.from(await roster.arrayBuffer());
    await s3Client.send(
      new PutObjectCommand({
        Bucket: "bot-roster-bucket",
        Key: `${server}/${roster.name}`,
        Body: buffer,
        ContentType: "text/csv",
      })
    );
  } catch (err) {
    throw new Error(`Failed to store roster to bucket: ${err}`);
  }
};
