import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  return handleTwiml(req);
}

export async function POST(req: NextRequest) {
  return handleTwiml(req);
}

function handleTwiml(req: NextRequest) {
  const twilioStreamUrl = process.env.TWILIO_STREAM_URL;

  // If a live ngrok/WebSocket Media Stream is configured (from BISVEDA_VoiceCall_Twilio.ipynb)
  if (twilioStreamUrl) {
    const streamXml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${twilioStreamUrl}" />
  </Connect>
</Response>`;
    return new NextResponse(streamXml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
      },
    });
  }

  // Standalone TwiML greeting with BISVEDA voice response
  const defaultXml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="hi-IN" voice="Polly.Aditi">
    Namaste! Bureau of Indian Standards BISVEDA AI Helpline mein aapka swagat hai.
  </Say>
  <Pause length="1"/>
  <Say language="en-IN" voice="Polly.Aditi">
    Welcome to the BISVEDA AI voice assistant. All Indian standards, ISI marks, and hallmarking inquiries are verified by BIS.
  </Say>
  <Pause length="2"/>
  <Say language="hi-IN" voice="Polly.Aditi">
    Aapka call connect kiya ja raha hai.
  </Say>
</Response>`;

  return new NextResponse(defaultXml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
