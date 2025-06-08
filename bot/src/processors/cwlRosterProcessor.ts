import { S3Event } from "aws-lambda";
import { s3Client } from "../clients/s3-client";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { parse } from "csv-parse/sync";

export const processCwlRoster = async (event: S3Event) => {
    console.log(JSON.stringify(event));
    for (const record of event.Records) {
        const bucket = record.s3.bucket.name;
        const key = record.s3.object.key;

        const response = await s3Client.send(new GetObjectCommand({
            Bucket: bucket,
            Key: key
        }));

        const csvData = await streamCsv(response.Body as Readable);
        console.log(csvData);

        const records = parse(csvData, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });
        // console.log(records);

        let clanTag = '';
        let clanLeague = '';
        for (const record of records) {
            if (record['@'] === '') {
                console.log(JSON.stringify(record));
                clanLeague = record['Player Name'],
                clanTag = record['Combined Heroes'].split('=')[2];
                console.log(`Setting clanLeague to ${clanLeague} and clanTag to ${clanTag}`)
            } else {
                console.log(`${record['@']} has account ${record['Player Tag']} in ${clanLeague} clan: ${clanTag}`);
            }
        }
    }
}

const streamCsv = async (stream: Readable) => {
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks).toString('utf-8');
}