"""
BISVEDA Real-time Voice Call Assistant — Exotel + Gemini Live Runner
Natural Multilingual Conversational AI with Instant Barge-In / Interruption Engine
Bidirectional 8kHz PCM16 Telephony <-> Gemini Live 16kHz in / 24kHz out
"""

import os
import sys
import json
import time
import base64
import asyncio
import audioop
import logging
import traceback
import requests
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Response, Request
import uvicorn
from pyngrok import ngrok
from google import genai
from google.genai import types

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("bisveda-exotel")

def load_dotenv_fallback():
    """Load key-value pairs from .env into os.environ if not already set."""
    candidates = [
        os.path.join(os.path.dirname(__file__), "..", "..", ".env"),
        os.path.join(os.path.dirname(__file__), "..", "..", "prototype", ".env"),
        ".env",
        os.path.join("prototype", ".env"),
    ]
    for c in candidates:
        abs_p = os.path.abspath(c)
        if os.path.isfile(abs_p):
            try:
                with open(abs_p, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            k = k.strip()
                            v = v.strip().strip('"').strip("'")
                            if k and k not in os.environ:
                                os.environ[k] = v
            except Exception:
                pass

load_dotenv_fallback()

def get_env(key, default=""):
    return os.environ.get(key, default)

# ── Credentials & Configuration (Loaded securely from .env) ──
GEMINI_API_KEY = get_env("VOICE_GEMINI_API_KEY") or get_env("GEMINI_API_KEY")
GEMINI_MODEL = get_env("VOICE_GEMINI_MODEL", "gemini-3.1-flash-live-preview")

EXOTEL_ACCOUNT_SID = get_env("EXOTEL_ACCOUNT_SID")
EXOTEL_API_KEY = get_env("EXOTEL_API_KEY")
EXOTEL_API_TOKEN = get_env("EXOTEL_API_TOKEN")
EXOTEL_CALLER_ID = get_env("EXOTEL_CALLER_ID")
EXOTEL_APP_ID = get_env("EXOTEL_APP_ID")
MY_PHONE_NUMBER = get_env("MY_PHONE_NUMBER")

NGROK_AUTHTOKEN = get_env("NGROK_AUTHTOKEN")
PORT = int(get_env("VOICE_PORT", "8001"))

EXOTEL_SAMPLE_RATE = 8000
EXOTEL_CHANNELS = 1

# Barge-In VAD Threshold (RMS amplitude on 8kHz linear PCM16)
SPEECH_RMS_THRESHOLD = 900
CONSECUTIVE_VOICED_PACKETS = 2

# Audio & call state
AUDIO_STATE = {}
CALL_STATE = {}
ACTIVE_CALLS = {}

def _audio_state(call_id: str):
    return AUDIO_STATE.setdefault(
        call_id,
        {"in": None, "out": None},
    )

def _call_state(call_id: str):
    return CALL_STATE.setdefault(
        call_id,
        {
            "ai_is_speaking": False,
            "barge_in_active": False,
            "consecutive_speech_pkts": 0,
            "phone": "unknown",
            "stream_sid": None,
        },
    )

def exotel_to_gemini_pcm16(payload_b64: str, call_id: str) -> tuple[bytes, int]:
    """Exotel 8 kHz raw PCM16 -> Gemini 16 kHz raw PCM16 + RMS calculation."""
    raw_pcm8k = base64.b64decode(payload_b64)
    if len(raw_pcm8k) % 2:
        raw_pcm8k = raw_pcm8k[:-1]
    
    rms = audioop.rms(raw_pcm8k, 2) if raw_pcm8k else 0
    state = _audio_state(call_id)
    pcm16k, state["in"] = audioop.ratecv(
        raw_pcm8k, 2, EXOTEL_CHANNELS,
        EXOTEL_SAMPLE_RATE, 16000,
        state["in"],
    )
    return pcm16k, rms

def gemini_to_exotel_pcm16(pcm24k: bytes, call_id: str) -> bytes:
    """Gemini 24 kHz PCM16 -> Exotel 8 kHz PCM16 (direct unbuffered streaming as in reference notebook)."""
    if not pcm24k:
        return b""
    if len(pcm24k) % 2:
        pcm24k = pcm24k[:-1]
    state = _audio_state(call_id)
    pcm8k, state["out"] = audioop.ratecv(
        pcm24k, 2, 1,
        24000, EXOTEL_SAMPLE_RATE,
        state["out"],
    )
    return pcm8k

def clear_audio_state(call_id: str):
    AUDIO_STATE.pop(call_id, None)
    CALL_STATE.pop(call_id, None)

# ── Gemini Client ──
gemini_client = genai.Client(api_key=GEMINI_API_KEY)

# ── Natural Multilingual System Prompt ──
SYSTEM_PROMPT = """
You are "BISVEDA" (बिसवेदा), the official AI Voice Assistant for the Bureau of Indian Standards (BIS), Ministry of Consumer Affairs, Government of India.
You are speaking live on a telephone call with an Indian citizen, consumer, or MSME business owner.

CRITICAL CONVERSATIONAL RULES (NATURAL PHONE CALL):
1. Speak naturally, warmly, and concisely (1 to 2 sentences per turn). This is a real-time phone call. Never give long lectures, never recite bullet points, and never sound like a robotic IVR script.
2. DO NOT REPEAT ANNOYING CATCHPHRASES:
   - NEVER say "क्या आपका कोई और सवाल है?" or "Is there anything else?" at the end of every answer.
   - Answer the question directly and simply stop talking so the caller can speak naturally.
3. NEVER recite unprompted philosophical monologues or irrelevant commentary. Stay focused solely on the user's inquiry.
4. Let the conversation breathe. Answer what is asked, accurately and helpfully.

STRICT MULTILINGUAL LANGUAGE MIRRORING (22 INDIAN SCHEDULED LANGUAGES):
- ALWAYS detect the caller's language and respond in that EXACT same language immediately!
- MARATHI LANGUAGE RULES:
  * If the caller speaks Marathi or asks if you speak Marathi ("तुम मराठी बोल सकते हो?", "तुम्ही मराठी बोलू शकता का?", "Can you speak in Marathi?"):
    IMMEDIATELY switch and reply warmly in fluent Marathi:
    "हो, नक्कीच! मी मराठीत बोलू शकतो. बीआयएस (BIS) हेल्पलाईनवर तुमचे स्वागत आहे. मी तुम्हाला कशी मदत करू?"
  * If asked about helmets in Marathi ("मला हेल्मेटबद्दल माहिती हवी आहे" / "हेल्मेटसाठी कोणता स्टँडर्ड लागतो?"):
    "दोन चाकी वाहनांच्या हेल्मेटसाठी IS 4151 हे मानक लागू आहे. या मानकाचा ISI मार्क असणे कायद्याने अनिवार्य आहे."
  * If asked about testing labs in Marathi ("टेस्ट कुठे करू शकतो?"):
    "बीआयएसची मध्यवर्ती प्रयोगशाळा साहिबाबादमध्ये आहे. याव्यतिरिक्त मुंबई आणि पुण्यातही बीआयएस मान्यताप्राप्त प्रयोगशाळा आहेत जिथे हेल्मेट आणि इतर वस्तूंची चाचणी केली जाते."
- HINDI LANGUAGE RULES:
  * If the caller speaks Hindi or Hinglish, reply in warm, natural conversational Hindi.
- ENGLISH LANGUAGE RULES:
  * If the caller speaks in English, reply in fluent, polite Indian English.
- OTHER INDIAN LANGUAGES:
  * If the caller speaks Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi, Odia, etc., detect and converse in that language with full fluency.

CORE BIS FACTUAL KNOWLEDGE:
- Two-Wheeler Helmets: IS 4151. Mandatory ISI certification under the Quality Control Order (QCO). Selling non-ISI helmets is illegal.
- Testing Laboratories: BIS Central Laboratory at Sahibabad (Ghaziabad / Delhi NCR), regional laboratories in Mumbai, Kolkata, Chennai, Chandigarh, and accredited labs in Pune, Bengaluru, etc.
- Gold Hallmarking: IS 1417. Mandatory for jewellery (14K, 18K, 20K, 22K (916), 24K). Three marks: BIS Logo, purity grade, and 6-digit alphanumeric HUID.
- Verify Gold HUID: Check on the official "BIS Care" mobile app under 'Verify HUID'.
- ISI Mark & CM/L Number: Genuine ISI marks have "IS [number]" on top and a 7 or 8 digit licence number (CM/L-XXXXXXX) at the bottom. Verify on the BIS Care app.
- Steel Pipes & Tubes: IS 1239 (mild steel) and IS 1161 (structural). Mandatory under Steel QCO.
- Packaged Drinking Water: IS 14543 (packaged drinking water) and IS 13428 (mineral water). Mandatory Scheme-I ISI mark.
- Cement: IS 269 (Ordinary Portland Cement) and IS 1489 (PPC). Mandatory under Cement QCO.
- Toys: IS 9873 (mechanical safety) and IS 15644 (electric toys). Mandatory under Toys QCO.
"""

app = FastAPI(title="BISVEDA Exotel Voice Bridge")

PUBLIC_HTTPS_URL = ""
EXOTEL_STREAM_URL = ""

@app.get("/")
def root():
    return {
        "service": "BISVEDA AI Voice Assistant",
        "transport": "Exotel AgentStream",
        "websocket": "/bisveda/media",
        "audio": "PCM16 mono 8000Hz",
        "model": GEMINI_MODEL,
        "active_calls": len(ACTIVE_CALLS),
    }

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "BISVEDA AI Voice Assistant",
        "transport": "Exotel AgentStream",
        "account_sid": EXOTEL_ACCOUNT_SID,
        "caller_id": EXOTEL_CALLER_ID,
        "stream_url": EXOTEL_STREAM_URL,
        "active_calls": len(ACTIVE_CALLS),
    }

@app.post("/call")
async def trigger_call(req: Request):
    """Convenience endpoint to trigger an outbound Exotel call."""
    data = await req.json()
    phone = data.get("phone_number") or MY_PHONE_NUMBER
    digits = "".join(filter(str.isdigit, str(phone)))
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]

    stream_url = f"{EXOTEL_STREAM_URL}?sample-rate={EXOTEL_SAMPLE_RATE}"
    url = f"https://api.exotel.com/v1/Accounts/{EXOTEL_ACCOUNT_SID}/Calls/connect.json"

    payload = {
        "From": digits,
        "CallerId": EXOTEL_CALLER_ID,
        "StreamUrl": stream_url,
        "StreamType": "bidirectional",
    }

    try:
        r = requests.post(
            url,
            auth=(EXOTEL_API_KEY, EXOTEL_API_TOKEN),
            data=payload,
            timeout=15,
        )
        log.info(f"Triggered Exotel call to {digits}: HTTP {r.status_code}")
        return r.json()
    except Exception as e:
        log.error(f"Failed to place Exotel call: {e}")
        return {"error": str(e)}, 500

async def _read_until_start(websocket: WebSocket):
    """Wait for Exotel's start event and return metadata."""
    while True:
        raw = await websocket.receive_text()
        try:
            event = json.loads(raw)
        except json.JSONDecodeError:
            continue

        event_type = event.get("event")
        if event_type == "connected":
            log.info("Exotel event: connected")
            continue

        if event_type == "start":
            start = event.get("start") or {}
            stream_sid = event.get("stream_sid") or start.get("stream_sid")
            call_sid = start.get("call_sid") or stream_sid or f"call_{int(time.time())}"
            phone = start.get("from") or "unknown"
            return {
                "call_id": call_sid,
                "stream_sid": stream_sid,
                "phone": phone,
                "start": start,
            }

        if event_type == "stop":
            log.info(f"Exotel sent stop during handshake: {event}")
            return None

@app.websocket("/bisveda/media")
async def bisveda_media(websocket: WebSocket):
    await websocket.accept()

    call_id = f"call_{int(time.time())}"
    stream_sid = None
    started_at = time.time()
    log.info(f"[{call_id}] Exotel WebSocket connected")

    try:
        # Wait for handshake start event
        start_info = await _read_until_start(websocket)
        if not start_info:
            log.warn(f"[{call_id}] Connection closed before start event")
            await websocket.close()
            return

        call_id = start_info["call_id"]
        stream_sid = start_info["stream_sid"]
        phone = start_info["phone"]

        c_state = _call_state(call_id)
        c_state["phone"] = phone
        c_state["stream_sid"] = stream_sid
        c_state["ai_is_speaking"] = True
        c_state["barge_in_active"] = False
        c_state["consecutive_speech_pkts"] = 0

        ACTIVE_CALLS[call_id] = {"stream_sid": stream_sid, "phone": phone, "started_at": started_at}
        log.info(f"[{call_id}] EXOTEL_START verified | stream_sid={stream_sid} | phone={phone}")

        # Connect to Gemini Live Session with transcription configs
        async with gemini_client.aio.live.connect(
            model=GEMINI_MODEL,
            config=types.LiveConnectConfig(
                response_modalities=["AUDIO"],
                system_instruction=SYSTEM_PROMPT,
                input_audio_transcription=types.AudioTranscriptionConfig(),
                output_audio_transcription=types.AudioTranscriptionConfig(),
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Aoede")
                    )
                ),
            ),
        ) as gemini:
            log.info(f"[{call_id}] Gemini Live session connected!")

            # ── Exotel -> Gemini (Caller live voice audio + Barge-In VAD) ──
            async def exotel_to_gemini():
                nonlocal stream_sid, call_id
                in_packets = 0
                try:
                    while True:
                        raw = await websocket.receive_text()
                        try:
                            event = json.loads(raw)
                        except json.JSONDecodeError:
                            continue

                        event_type = event.get("event")

                        if event_type == "media":
                            media = event.get("media") or {}
                            payload = media.get("payload")
                            if payload:
                                in_packets += 1
                                pcm16k, rms = exotel_to_gemini_pcm16(payload, call_id)

                                # ── Barge-In / Interruption Engine ──
                                if c_state["ai_is_speaking"]:
                                    if rms >= SPEECH_RMS_THRESHOLD:
                                        c_state["consecutive_speech_pkts"] += 1
                                    else:
                                        c_state["consecutive_speech_pkts"] = 0

                                    if c_state["consecutive_speech_pkts"] >= CONSECUTIVE_VOICED_PACKETS:
                                        # Human voice detected! Interrupt the AI immediately!
                                        log.info(f"[{call_id}] ⚡ BARGE-IN DETECTED (RMS: {rms}) -> Purging Exotel playout buffer!")
                                        c_state["ai_is_speaking"] = False
                                        c_state["barge_in_active"] = True
                                        c_state["consecutive_speech_pkts"] = 0

                                        # Send Exotel clear event to silence caller handset speaker instantly
                                        await websocket.send_text(json.dumps({
                                            "event": "clear",
                                            "stream_sid": stream_sid,
                                        }))

                                        # Forward voiced audio to Gemini
                                        await gemini.send_realtime_input(
                                            audio=types.Blob(data=pcm16k, mime_type="audio/pcm;rate=16000")
                                        )
                                else:
                                    # AI is NOT speaking: stream caller voice audio directly to Gemini Live
                                    await gemini.send_realtime_input(
                                        audio=types.Blob(data=pcm16k, mime_type="audio/pcm;rate=16000")
                                    )

                        elif event_type == "dtmf":
                            digit = (event.get("dtmf") or {}).get("digit")
                            log.info(f"[{call_id}] Exotel DTMF: {digit}")

                        elif event_type == "stop":
                            log.info(f"[{call_id}] Exotel stop received: {event}")
                            return
                except WebSocketDisconnect:
                    log.info(f"[{call_id}] Exotel WebSocket disconnected")
                    return
                except Exception as e:
                    log.warn(f"[{call_id}] exotel_to_gemini error: {e}")
                    return

            # ── Gemini -> Exotel (Continuous Multi-turn Direct Spoken Audio) ──
            async def gemini_to_exotel():
                nonlocal stream_sid, call_id
                out_packets = 0
                turn = 0

                # Continuous multi-turn loop: keeps receiving audio across ALL caller turns!
                while True:
                    turn += 1
                    try:
                        async for response in gemini.receive():
                            server_content = getattr(response, "server_content", None)

                            if server_content:
                                # Log caller speech transcription
                                itx = getattr(server_content, "input_transcription", None)
                                if itx and getattr(itx, "text", None):
                                    caller_text = itx.text.strip()
                                    if caller_text:
                                        log.info(f"[{call_id}] 👤 CALLER: {caller_text}")

                                # Log assistant speech transcription
                                otx = getattr(server_content, "output_transcription", None)
                                if otx and getattr(otx, "text", None):
                                    ai_text = otx.text.strip()
                                    if ai_text:
                                        log.info(f"[{call_id}] 🤖 BISVEDA: {ai_text}")

                                # Handle spoken audio streaming back from Gemini
                                model_turn = getattr(server_content, "model_turn", None)
                                if model_turn:
                                    if c_state["barge_in_active"]:
                                        continue

                                    c_state["ai_is_speaking"] = True

                                    for part in (getattr(model_turn, "parts", None) or []):
                                        inline_data = getattr(part, "inline_data", None)
                                        if not inline_data:
                                            continue
                                        audio_data = getattr(inline_data, "data", None)
                                        if not audio_data or c_state["barge_in_active"]:
                                            continue

                                        # Resample 24kHz -> 8kHz directly and send immediately (as in BISVEDA_VoiceCall.ipynb)
                                        pcm8k = gemini_to_exotel_pcm16(audio_data, call_id)
                                        if pcm8k and not c_state["barge_in_active"]:
                                            out_packets += 1
                                            if out_packets == 1:
                                                log.info(f"[{call_id}] 🔊 First AI audio packet sent to caller ({len(pcm8k)} bytes)")
                                            payload = base64.b64encode(pcm8k).decode("ascii")
                                            await websocket.send_text(json.dumps({
                                                "event": "media",
                                                "stream_sid": stream_sid,
                                                "media": {"payload": payload},
                                            }))

                                if getattr(server_content, "turn_complete", False):
                                    c_state["ai_is_speaking"] = False
                                    c_state["barge_in_active"] = False
                                    c_state["consecutive_speech_pkts"] = 0
                                    log.info(f"[{call_id}] Turn {turn} completed (cumulative out packets: {out_packets}). Listening...")

                    except Exception as e:
                        msg = str(e).lower()
                        if "1000" in msg or "closed" in msg or isinstance(e, asyncio.CancelledError):
                            log.info(f"[{call_id}] Gemini session ended cleanly")
                            break
                        else:
                            log.warn(f"[{call_id}] gemini_to_exotel error in turn {turn}: {e}")
                            await asyncio.sleep(0.05)

            # Start streaming loops: receiver first so it catches greeting audio chunks immediately
            out_task = asyncio.create_task(gemini_to_exotel())
            in_task = asyncio.create_task(exotel_to_gemini())

            # Trigger clean opening greeting immediately
            try:
                await gemini.send_client_content(
                    turns=[{
                        "role": "user",
                        "parts": [{
                            "text": (
                                "The caller has answered the call. Please speak your opening greeting out loud right now: "
                                "Greet the caller warmly in Hindi and English as the official BISVEDA AI Helpline, "
                                "tell them they can speak in Marathi, Hindi, English, or any Indian language, "
                                "and ask how you can help them today."
                            )
                        }],
                    }],
                    turn_complete=True,
                )
                log.info(f"[{call_id}] Opening greeting instruction dispatched to Gemini Live")
            except Exception as ge:
                log.error(f"[{call_id}] Failed to dispatch greeting: {ge}")

            # Keep connection running until caller hangs up (in_task completes) or error occurs
            done, pending = await asyncio.wait(
                {in_task, out_task},
                return_when=asyncio.FIRST_COMPLETED,
            )
            for t in pending:
                t.cancel()

    except WebSocketDisconnect:
        log.info(f"[{call_id}] Disconnected")
    except Exception as e:
        log.error(f"[{call_id}] Unhandled bridge error: {e}")
        traceback.print_exc()
    finally:
        ACTIVE_CALLS.pop(call_id, None)
        clear_audio_state(call_id)
        duration = round(time.time() - started_at, 1)
        log.info(f"[{call_id}] Call finished. Total duration: {duration}s")

def sync_bridge_config(public_https: str, public_wss: str):
    """Write .voice_bridge.json in workspace and prototype directory so portal picks it up."""
    config = {
        "active": True,
        "provider": "exotel",
        "public_url": public_https,
        "stream_url": f"{public_wss}/bisveda/media",
        "account_sid": EXOTEL_ACCOUNT_SID,
        "caller_id": EXOTEL_CALLER_ID,
        "app_id": EXOTEL_APP_ID,
        "port": PORT,
        "timestamp": time.time(),
    }
    paths = [
        os.path.join(os.getcwd(), ".voice_bridge.json"),
        os.path.join(os.getcwd(), "prototype", ".voice_bridge.json"),
    ]
    for p in paths:
        try:
            os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, "w", encoding="utf-8") as f:
                json.dump(config, f, indent=2)
            log.info(f"Synced Exotel bridge config to {p}")
        except Exception as e:
            log.warn(f"Could not write {p}: {e}")

def main():
    global PUBLIC_HTTPS_URL, EXOTEL_STREAM_URL

    print("=" * 70)
    print("  BISVEDA Voice Call Assistant — Exotel + Gemini Live Bridge")
    print("  Natural Multilingual Indic AI with Real-Time Barge-In (VAD)")
    print("=" * 70)
    print(f"Exotel Account SID: {EXOTEL_ACCOUNT_SID}")
    print(f"Exotel Caller ID:   {EXOTEL_CALLER_ID}")
    print(f"Gemini Model:       {GEMINI_MODEL}")
    print(f"Audio Format:       PCM16 8000Hz mono <-> Gemini 16kHz in / 24kHz out")

    # Start ngrok
    ngrok.set_auth_token(NGROK_AUTHTOKEN)
    try:
        ngrok.kill()
    except Exception:
        pass

    tunnel = ngrok.connect(PORT, "http")
    PUBLIC_HTTPS_URL = tunnel.public_url
    if PUBLIC_HTTPS_URL.startswith("https://"):
        public_wss = "wss://" + PUBLIC_HTTPS_URL[len("https://"):]
    elif PUBLIC_HTTPS_URL.startswith("http://"):
        public_wss = "wss://" + PUBLIC_HTTPS_URL[len("http://"):]
    else:
        public_wss = "wss://" + PUBLIC_HTTPS_URL

    EXOTEL_STREAM_URL = f"{public_wss}/bisveda/media"
    sync_bridge_config(PUBLIC_HTTPS_URL, public_wss)

    print("=" * 70)
    print(f"NGROK PUBLIC HTTPS : {PUBLIC_HTTPS_URL}")
    print(f"EXOTEL STREAM WSS  : {EXOTEL_STREAM_URL}")
    print(f"HEALTH CHECK       : {PUBLIC_HTTPS_URL}/health")
    print("=" * 70)

    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="warning")

if __name__ == "__main__":
    main()
