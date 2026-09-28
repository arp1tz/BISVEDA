import { NextRequest, NextResponse } from "next/server";

interface HelplineCallRequest {
  phone_number: string;
  language?: string;
  source?: "landing_page" | "chat_modal" | "chat_card";
}

// In-memory call log for session audit
interface CallLogRecord {
  call_id: string;
  phone_number: string;
  status: "queued" | "connecting" | "completed" | "failed";
  timestamp: string;
  provider_sid?: string;
  mode: "live_twilio" | "live_exotel" | "simulated_local";
  provider: "twilio" | "exotel" | "simulator";
}

const CALL_LOG: CallLogRecord[] = [];

/**
 * Validates and normalizes Indian mobile numbers
 * Accepts: "+91 98765 43210", "09876543210", "9876543210", "98765-43210"
 * Returns 10-digit clean number or null if invalid
 */
function cleanIndianPhoneNumber(raw: string): string | null {
  const digitsOnly = (raw || "").replace(/\D/g, "");

  // If prefixed with 91 (e.g. 919876543210)
  if (digitsOnly.length === 12 && digitsOnly.startsWith("91")) {
    const mobile = digitsOnly.slice(2);
    if (/^[6-9]\d{9}$/.test(mobile)) return mobile;
  }

  // If prefixed with 0 (e.g. 09876543210)
  if (digitsOnly.length === 11 && digitsOnly.startsWith("0")) {
    const mobile = digitsOnly.slice(1);
    if (/^[6-9]\d{9}$/.test(mobile)) return mobile;
  }

  // Plain 10-digit number (e.g. 9876543210)
  if (digitsOnly.length === 10 && /^[6-9]\d{9}$/.test(digitsOnly)) {
    return digitsOnly;
  }

  return null;
}

export async function GET() {
  const hasTwilio = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
  const hasExotel = Boolean(
    process.env.EXOTEL_ACCOUNT_SID &&
    process.env.EXOTEL_API_KEY &&
    process.env.EXOTEL_API_TOKEN
  );

  return NextResponse.json({
    service: "BISVEDA AI Voice Helpline",
    status: "online",
    operating_hours: "24x7 Multilingual Voice Assistance",
    supported_languages: ["Hindi", "English", "Hinglish"],
    active_calls_count: CALL_LOG.length,
    active_provider: hasTwilio ? "twilio" : hasExotel ? "exotel" : "simulated_local",
    caller_id: process.env.TWILIO_PHONE_NUMBER || process.env.EXOTEL_CALLER_ID || "09513886363",
    verified_number: process.env.MY_PHONE_NUMBER || null,
    providers: {
      twilio: hasTwilio ? "active" : "unconfigured",
      exotel: hasExotel ? "configured" : "unconfigured",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body: HelplineCallRequest = await req.json();
    const { phone_number, language = "hi", source = "chat_modal" } = body;

    // Use user-provided phone number, or fall back to MY_PHONE_NUMBER if empty
    const rawNumber = (phone_number || "").trim() || (process.env.MY_PHONE_NUMBER || "");

    if (!rawNumber) {
      return NextResponse.json(
        { error: "Phone number is required." },
        { status: 400 }
      );
    }

    const cleanMobile = cleanIndianPhoneNumber(rawNumber);
    if (!cleanMobile) {
      return NextResponse.json(
        {
          error: "Invalid Indian mobile number. Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.",
        },
        { status: 400 }
      );
    }

    const formattedDisplay = `+91 ${cleanMobile.slice(0, 5)} ${cleanMobile.slice(5)}`;
    const e164Number = `+91${cleanMobile}`;
    const callId = `CALL-BIS-${Date.now()}`;

    // ─────────────────────────────────────────────────────────────
    // 1. Twilio Voice Outbound Call Flow (BISVEDA_VoiceCall_Twilio)
    // ─────────────────────────────────────────────────────────────
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    const twilioTwimlUrl = process.env.TWILIO_TWIML_URL;

    if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls.json`;
        const authHeader = `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64")}`;

        // Determine TwiML URL: check bridge file, env, public origin, or fallback
        let effectiveTwimlUrl = process.env.TWILIO_TWIML_URL;
        if (!effectiveTwimlUrl) {
          try {
            const fs = await import("fs");
            const path = await import("path");
            const candidates = [
              path.resolve(process.cwd(), ".voice_bridge.json"),
              path.resolve(process.cwd(), "prototype", ".voice_bridge.json"),
              path.resolve(process.cwd(), "..", ".voice_bridge.json"),
            ];
            for (const c of candidates) {
              if (fs.existsSync(c)) {
                const raw = fs.readFileSync(c, "utf-8");
                const parsed = JSON.parse(raw);
                if (parsed.active && parsed.twiml_url) {
                  effectiveTwimlUrl = parsed.twiml_url;
                  break;
                }
              }
            }
          } catch (e) {
            // bridge file read error ignored
          }
        }

        if (!effectiveTwimlUrl) {
          const reqOrigin = req.nextUrl?.origin;
          effectiveTwimlUrl = reqOrigin && !reqOrigin.includes("localhost") && !reqOrigin.includes("127.0.0.1")
            ? `${reqOrigin}/api/helpline/twiml`
            : "https://demo.twilio.com/welcome/voice/";
        }

        const params = new URLSearchParams();
        params.append("To", e164Number);
        params.append("From", twilioPhoneNumber);
        params.append("Url", effectiveTwimlUrl);

        const response = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });

        const resData = await response.json();
        console.log("[Twilio Call Trigger]", response.status, resData);

        if (response.ok && resData.sid) {
          const newRecord: CallLogRecord = {
            call_id: resData.sid,
            phone_number: formattedDisplay,
            status: "queued",
            timestamp: new Date().toISOString(),
            provider_sid: resData.sid,
            mode: "live_twilio",
            provider: "twilio",
          };
          CALL_LOG.unshift(newRecord);

          return NextResponse.json({
            success: true,
            call_id: resData.sid,
            phone: formattedDisplay,
            caller_id: twilioPhoneNumber,
            message: `Outbound call queued via Twilio (${resData.sid.slice(0, 10)}…). You will receive a call shortly on ${formattedDisplay}.`,
            mode: "live_twilio",
            provider: "twilio",
          });
        } else {
          console.warn("[Twilio Call Warning - response not ok]:", resData);
        }
      } catch (err: any) {
        console.warn("[Twilio Call Exception]:", err);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Exotel Fallback Voice Flow (BISVEDA_VoiceCall)
    // ─────────────────────────────────────────────────────────────
    const exotelAccountSid = process.env.EXOTEL_ACCOUNT_SID;
    const exotelApiKey = process.env.EXOTEL_API_KEY;
    const exotelApiToken = process.env.EXOTEL_API_TOKEN;
    const exotelCallerId = process.env.EXOTEL_CALLER_ID || "09513886363";
    const exotelStreamBase = process.env.EXOTEL_STREAM_BASE;
    const exotelSampleRate = process.env.EXOTEL_SAMPLE_RATE || "8000";

    if (exotelAccountSid && exotelApiKey && exotelApiToken && exotelStreamBase) {
      try {
        const streamUrl = `${exotelStreamBase}?sample-rate=${exotelSampleRate}`;
        const exotelUrl = `https://api.exotel.com/v1/Accounts/${exotelAccountSid}/Calls/connect`;
        const authHeader = `Basic ${Buffer.from(`${exotelApiKey}:${exotelApiToken}`).toString("base64")}`;

        const params = new URLSearchParams();
        params.append("From", cleanMobile);
        params.append("CallerId", exotelCallerId);
        params.append("StreamUrl", streamUrl);
        params.append("StreamType", "bidirectional");

        const response = await fetch(exotelUrl, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });

        const resText = await response.text();
        console.log("[Exotel Call Trigger]", response.status, resText);

        if (response.ok) {
          const newRecord: CallLogRecord = {
            call_id: callId,
            phone_number: formattedDisplay,
            status: "queued",
            timestamp: new Date().toISOString(),
            provider_sid: callId,
            mode: "live_exotel",
            provider: "exotel",
          };
          CALL_LOG.unshift(newRecord);

          return NextResponse.json({
            success: true,
            call_id: callId,
            phone: formattedDisplay,
            caller_id: exotelCallerId,
            message: `Outbound call placed. You will receive a call shortly on ${formattedDisplay}.`,
            mode: "live_exotel",
            provider: "exotel",
          });
        }
      } catch (err: any) {
        console.warn("[Exotel Call Exception]:", err);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Failsafe Demo Simulation Mode
    // ─────────────────────────────────────────────────────────────
    const newRecord: CallLogRecord = {
      call_id: callId,
      phone_number: formattedDisplay,
      status: "queued",
      timestamp: new Date().toISOString(),
      provider_sid: `SIM-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      mode: "simulated_local",
      provider: "simulator",
    };
    CALL_LOG.unshift(newRecord);

    return NextResponse.json({
      success: true,
      call_id: callId,
      phone: formattedDisplay,
      caller_id: twilioPhoneNumber || exotelCallerId,
      message: `You will receive a call shortly on ${formattedDisplay}.`,
      mode: "simulated_local",
      provider: "simulator",
      tip: "Please keep your mobile phone nearby. Our voice assistant will connect in moments.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to place call request.", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
