import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        AWS_REGION: process.env.AWS_REGION,
        NEXT_PUBLIC_AWS_REGION: process.env.NEXT_PUBLIC_AWS_REGION,
        NEXT_PUBLIC_GUILD_ID: process.env.NEXT_PUBLIC_GUILD_ID,
        hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
        hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
        accessKeyLength: process.env.AWS_ACCESS_KEY_ID?.length || 0,
        secretKeyLength: process.env.AWS_SECRET_ACCESS_KEY?.length || 0,
      }
    };

    return NextResponse.json(debugInfo);
  } catch (error) {
    return NextResponse.json({ 
      error: 'Debug endpoint failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}