import { NextResponse } from 'next/server';
import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";

export async function GET() {
  try {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV || 'unknown',
        AWS_REGION: process.env.AWS_REGION || 'not-set',
        NEXT_PUBLIC_AWS_REGION: process.env.NEXT_PUBLIC_AWS_REGION || 'not-set',
        NEXT_PUBLIC_GUILD_ID: process.env.NEXT_PUBLIC_GUILD_ID || 'not-set',
        hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
        hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
        accessKeyLength: process.env.AWS_ACCESS_KEY_ID?.length || 0,
        secretKeyLength: process.env.AWS_SECRET_ACCESS_KEY?.length || 0,
        accessKeyPrefix: process.env.AWS_ACCESS_KEY_ID?.substring(0, 4) || 'N/A',
      },
      dynamodb: {
        connectionTest: 'Not tested',
        tables: [] as string[],
        error: null as string | null
      }
    };

    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      try {
        const client = new DynamoDBClient({
          region: process.env.AWS_REGION ?? "us-east-1",
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        });

        const tablesResult = await client.send(new ListTablesCommand({}));
        debugInfo.dynamodb.connectionTest = 'SUCCESS';
        debugInfo.dynamodb.tables = tablesResult.TableNames || [];
      } catch (error) {
        debugInfo.dynamodb.connectionTest = 'FAILED';
        debugInfo.dynamodb.error = error instanceof Error ? error.message : String(error);
      }
    }

    return NextResponse.json(debugInfo);
  } catch (error) {
    return NextResponse.json({ 
      error: 'Debug endpoint failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}