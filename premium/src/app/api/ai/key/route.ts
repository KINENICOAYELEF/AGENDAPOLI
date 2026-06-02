import { NextResponse } from 'next/server';

export async function GET() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'No GEMINI_API_KEY configured on server' }, { status: 404 });
    }
    return NextResponse.json({ apiKey });
}
