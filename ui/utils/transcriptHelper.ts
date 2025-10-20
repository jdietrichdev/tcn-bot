import { s3Client } from "@/app/clients/s3Client";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export const fetchTranscript = async (id: string): Promise<Record<string, any>[]> => {
  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: "bot-transcript-bucket",
        Key: id,
      })
    );
    return JSON.parse(await response.Body!.transformToString("utf-8"));
  } catch (err) {
    throw err;
  }
};
