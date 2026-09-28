"""
BISVEDA Real-time Voice Call Assistant — Twilio + Gemini Live Runner
Starts the FastAPI bridge, mounts ngrok tunnel, and connects bidirectional
telephony audio to Gemini Live (gemini-3.1-flash-live-preview).
"""

import os
import sys
import json
import time
import base64
import asyncio
import audioop
import logging
import threading
from urllib.parse import urlencode

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Response, Request
import uvicorn
from pyngrok import ngrok
from google import genai
from google.genai import types
from twilio.rest import Client as TwilioClient
from twilio.twiml.voice_response import VoiceResponse, Connect

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("bisveda-voice")

# Load environment configuration
def get_env(key, default=""):
    return os.environ.get(key, default)

GEMINI_API_KEY = get_env("VOICE_GEMINI_API_KEY") or get_env("GEMINI_API_KEY", "AQ.Ab8RN6JrOHqgvRTeVBWciSg1P4LcTEuVq6lDEh7tF0EctC-1Mw")
GEMINI_MODEL = "gemini-3.1-flash-live-preview"

TWILIO_ACCOUNT_SID = get_env("TWILIO_ACCOUNT_SID", "ACd2780ca61739d2d2420b2447e1d5a7dd")
TWILIO_AUTH_TOKEN = get_env("TWILIO_AUTH_TOKEN", "609db245347d7dd11bda0ab7c5ae29cf")
TWILIO_PHONE_NUMBER = get_env("TWILIO_PHONE_NUMBER", "+17372508034")
MY_PHONE_NUMBER = get_env("MY_PHONE_NUMBER", "9529512485")
NGROK_AUTHTOKEN = get_env("NGROK_AUTHTOKEN", "3JuYjB10Je24Y4vDMc7nmD8yvqk_6EvETNmVk772rHuTkJVLV")
PORT = int(get_env("VOICE_PORT", "8001"))

# Audio state buffer
AUDIO_STATE = {}

def twilio_to_gemini_pcm16(payload_b64: str, call_id: str) -> bytes:
    raw_mulaw = base64.b64decode(payload_b64)
    pcm8k = audioop.ulaw2lin(raw_mulaw, 2)
    state = AUDIO_STATE.setdefault(call_id, {"in": None, "out": None})
    pcm16k, state["in"] = audioop.ratecv(pcm8k, 2, 1, 8000, 16000, state["in"])
    return pcm16k

def gemini_to_twilio_payload(pcm24k: bytes, call_id: str) -> str:
    state = AUDIO_STATE.setdefault(call_id, {"in": None, "out": None})
    pcm8k, state["out"] = audioop.ratecv(pcm24k, 2, 1, 24000, 8000, state["out"])
    mulaw = audioop.lin2ulaw(pcm8k, 2)
    return base64.b64encode(mulaw).decode("ascii")

# Gemini Client
gemini_client = genai.Client(api_key=GEMINI_API_KEY)
twilio_client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

SYSTEM_PROMPT = """
You are "BISVEDA" (बिसवेदा), a warm, helpful, and knowledgeable AI voice assistant for the Bureau of Indian Standards (BIS).
You are speaking on a real phone call with an Indian citizen or business owner inquiring about:
- Indian Standards (e.g. IS 4151 for helmets, IS 1239 for steel, IS 1417 for gold hallmarking)
- ISI mark and CM/L license verification
- Gold & Silver hallmarking HUID checks
- Quality Control Orders (QCO) mandatory compliance
- BIS testing laboratories and Assaying & Hallmarking Centres (AHC)

CONVERSATIONAL RULES:
1. When the call starts, greet the caller warmly in Hindi first, then in English:
   "Namaste! BISVEDA AI Helpline mein aapka swagat hai. Welcome to the Bureau of Indian Standards assistant."
2. Invite them to speak: "Aap Hindi, English, ya apni bhasha mein sawaal pooch sakte hain."
3. Follow the caller's language naturally (Hindi, English, Hinglish, Marathi, Tamil, etc.).
4. Keep sentences concise, clear, and easy to understand over telephony audio (1-2 sentences at a time).
"""

app = FastAPI(title="BISVEDA Voice Bridge")

TWILIO_STREAM_URL = ""
TWILIO_TWIML_URL = ""

@app.api_route("/bisveda/twiml", methods=["GET", "POST"])
async def bisveda_twiml(request: Request):
    """Serve TwiML instructing Twilio to open bidirectional Media Stream."""
    stream_url = TWILIO_STREAM_URL
    response = VoiceResponse()
    connect = Connect()
    connect.stream(url=stream_url)
    response.append(connect)
    log.info(f"TwiML requested. Connecting stream to: {stream_url}")
    return Response(content=str(response), media_type="application/xml")

@app.get("/health")
def health():
    return {"status": "ok", "service": "BISVEDA Voice Server", "model": GEMINI_MODEL}

@app.websocket("/bisveda/media")
async def bisveda_media(websocket: WebSocket):
    await websocket.accept()
    call_id = "call_" + str(int(time.time()))
    stream_sid = None
    log.info(f"[{call_id}] Twilio WebSocket connected!")

    try:
        async with gemini_client.aio.live.connect(
            model=GEMINI_MODEL,
            config=types.LiveConnectConfig(
                response_modalities=["AUDIO"],
                system_instruction=SYSTEM_PROMPT,
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Aoede")
                    )
                ),
            ),
        ) as gemini:
            log.info(f"[{call_id}] Gemini Live session connected!")

            # Trigger opening greeting immediately
            await gemini.send_client_content(
                turns={
                    "role": "user",
                    "parts": [{"text": "The caller just answered. Greet them warmly in Hindi then English and ask how you can help."}],
                },
                turn_complete=True,
            )

            async def twilio_to_gemini():
                nonlocal stream_sid
                while True:
                    raw = await websocket.receive_text()
                    try:
                        event = json.loads(raw)
                    except json.JSONDecodeError:
                        continue

                    event_type = event.get("event")
                    if event_type == "start":
                        start = event.get("start", {})
                        stream_sid = event.get("streamSid") or start.get("streamSid")
                        log.info(f"[{call_id}] Media stream started: {stream_sid}")
                    elif event_type == "media":
                        payload = event.get("media", {}).get("payload")
                        if payload:
                            pcm16k = twilio_to_gemini_pcm16(payload, call_id)
                            await gemini.send_realtime_input(
                                audio=types.Blob(data=pcm16k, mime_type="audio/pcm;rate=16000")
                            )
                    elif event_type == "stop":
                        log.info(f"[{call_id}] Twilio stream stopped")
                        return

            async def gemini_to_twilio():
                nonlocal stream_sid
                while True:
                    try:
                        async for response in gemini.receive():
                            server_content = getattr(response, "server_content", None)
                            if not server_content:
                                continue

                            # Handle barge-in
                            if getattr(server_content, "interrupted", False):
                                await websocket.send_text(json.dumps({
                                    "event": "clear",
                                    "streamSid": stream_sid,
                                }))
                                log.info(f"[{call_id}] Barge-in detected: cleared audio buffer")

                            # Send model audio response
                            model_turn = getattr(server_content, "model_turn", None)
                            if model_turn:
                                for part in (getattr(model_turn, "parts", None) or []):
                                    inline_data = getattr(part, "inline_data", None)
                                    if inline_data and getattr(inline_data, "data", None):
                                        payload = gemini_to_twilio_payload(inline_data.data, call_id)
                                        await websocket.send_text(json.dumps({
                                            "event": "media",
                                            "streamSid": stream_sid,
                                            "media": {"payload": payload},
                                        }))
                    except Exception as e:
                        log.error(f"[{call_id}] Gemini error: {e}")
                        await asyncio.sleep(0.5)

            await asyncio.gather(twilio_to_gemini(), gemini_to_twilio())

    except WebSocketDisconnect:
        log.info(f"[{call_id}] Twilio disconnected")
    except Exception as e:
        log.error(f"[{call_id}] Session exception: {e}")
    finally:
        AUDIO_STATE.pop(call_id, None)

def place_call(phone: str):
    digits = "".join(c for c in phone if c.isdigit())
    if len(digits) == 10:
        clean = "+91" + digits
    elif len(digits) == 12 and digits.startswith("91"):
        clean = "+" + digits
    else:
        clean = "+91" + digits

    log.info(f"Placing outbound call to {clean} via {TWILIO_TWIML_URL}")
    call = twilio_client.calls.create(
        to=clean,
        from_=TWILIO_PHONE_NUMBER,
        url=TWILIO_TWIML_URL,
    )
    log.info(f"Call placed successfully! Call SID: {call.sid}")
    print(f"\n📞 CALL INITIATED (SID: {call.sid}) to {clean}!\nPlease answer your phone.")
    return call

if __name__ == "__main__":
    # Setup ngrok
    ngrok.set_auth_token(NGROK_AUTHTOKEN)
    try:
        ngrok.kill()
    except Exception:
        pass

    tunnel = ngrok.connect(PORT, "http")
    public_url = tunnel.public_url
    if public_url.startswith("https://"):
        public_wss = "wss://" + public_url[len("https://"):]
    else:
        public_wss = public_url.replace("http://", "wss://")

    TWILIO_STREAM_URL = public_wss + "/bisveda/media"
    TWILIO_TWIML_URL = public_url + "/bisveda/twiml"

    print("\n" + "=" * 65)
    print("🚀 BISVEDA VOICE ASSISTANT — TWILIO + GEMINI LIVE BRIDGE")
    print("=" * 65)
    print(f"Public HTTPS URL  : {public_url}")
    print(f"Twilio WSS URL    : {TWILIO_STREAM_URL}")
    print(f"Twilio TwiML URL  : {TWILIO_TWIML_URL}")
    print(f"Caller Phone No   : {TWILIO_PHONE_NUMBER}")
    print(f"Destination No    : {MY_PHONE_NUMBER}")
    print("=" * 65)

    if len(sys.argv) > 1 and sys.argv[1] == "--call":
        dest = sys.argv[2] if len(sys.argv) > 2 else MY_PHONE_NUMBER
        threading.Timer(3.0, lambda: place_call(dest)).start()

    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="warning")
