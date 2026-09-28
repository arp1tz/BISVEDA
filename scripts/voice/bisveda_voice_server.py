"""
BISVEDA Real-time Voice Call Assistant — Twilio + Gemini Live Runner
Starts the FastAPI bridge, mounts ngrok tunnel, registers BISVEDA tools,
and connects bidirectional telephony audio to Gemini Live (gemini-3.1-flash-live-preview).
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
CALLS = {}

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

# BIS Mock Data & Tools
MOCK_STANDARDS = {
    "IS 4151": {"title": "Protective Helmets for Two Wheeler Riders", "scope": "Safety requirements for motorcycle helmets", "qco": "Mandatory under QCO 2020", "scheme": "Scheme-I (ISI Mark)"},
    "IS 1239": {"title": "Steel Tubes, Tubulars and Other Wrought Steel Fittings", "scope": "Mild steel tubes for water, gas and sanitation", "qco": "Mandatory under Steel QCO", "scheme": "Scheme-I (ISI Mark)"},
    "IS 1417": {"title": "Gold and Gold Alloys, Silver and Silver Alloys — Hallmarking", "scope": "Purity standards for 14K, 18K, 22K (916), 24K jewellery", "qco": "Mandatory Hallmarking Order", "scheme": "Hallmarking (HUID)"},
    "IS 9873": {"title": "Safety of Toys — Mechanical and Physical Properties", "scope": "Safety requirements for toys for children under 14", "qco": "Mandatory Toys QCO 2020", "scheme": "Scheme-I (ISI Mark)"},
    "IS 14543": {"title": "Packaged Drinking Water (Other than Packaged Natural Mineral Water)", "scope": "Microbiological and chemical quality for bottled water", "qco": "Mandatory QCO", "scheme": "Scheme-I (ISI Mark)"},
    "IS 269": {"title": "Ordinary Portland Cement (33, 43 and 53 grade)", "scope": "Compressive strength and chemical composition of cement", "qco": "Mandatory Cement QCO", "scheme": "Scheme-I (ISI Mark)"},
}

TOOLS = [
    types.Tool(function_declarations=[
        types.FunctionDeclaration(
            name="search_standards",
            description="Search BIS standards by keyword, product name, or IS number.",
            parameters={"type": "OBJECT", "properties": {"query": {"type": "STRING", "description": "Search query"}}, "required": ["query"]},
        ),
        types.FunctionDeclaration(
            name="verify_isi_mark",
            description="Verify if a CM/L licence number or ISI mark is genuine.",
            parameters={"type": "OBJECT", "properties": {"cm_l_number": {"type": "STRING", "description": "The CM/L licence number"}}, "required": ["cm_l_number"]},
        ),
        types.FunctionDeclaration(
            name="verify_huid",
            description="Verify Hallmark Unique Identification (HUID) code on gold jewellery.",
            parameters={"type": "OBJECT", "properties": {"huid": {"type": "STRING", "description": "6-character alphanumeric HUID"}}, "required": ["huid"]},
        ),
        types.FunctionDeclaration(
            name="check_qco_compliance",
            description="Check whether a product falls under mandatory Quality Control Order (QCO).",
            parameters={"type": "OBJECT", "properties": {"product_name": {"type": "STRING", "description": "Product name in English"}}, "required": ["product_name"]},
        ),
        types.FunctionDeclaration(
            name="find_testing_labs",
            description="Find BIS recognized testing laboratories by product or city.",
            parameters={"type": "OBJECT", "properties": {"product_or_standard": {"type": "STRING", "description": "Product or standard"}, "location": {"type": "STRING", "description": "City or state"}}, "required": ["product_or_standard"]},
        ),
        types.FunctionDeclaration(
            name="end_call",
            description="End the phone call after speaking a polite closing goodbye out loud.",
            parameters={"type": "OBJECT", "properties": {"reason": {"type": "STRING", "description": "Reason for ending"}}},
        ),
    ])
]

def execute_tool_call(call_id: str, name: str, args: dict):
    log.info(f"[{call_id}] Executing tool: {name}({args})")
    if name == "search_standards":
        q = args.get("query", "").upper()
        matches = [s for is_num, s in MOCK_STANDARDS.items() if q in is_num or any(w in s["title"].upper() or w in s["scope"].upper() for w in q.split())]
        if not matches:
            matches = list(MOCK_STANDARDS.values())[:2]
        return {"status": "ok", "count": len(matches), "standards": matches[:3]}
    elif name == "verify_isi_mark":
        cml = args.get("cm_l_number", "")
        return {"status": "ok", "valid": True, "cm_l": cml, "manufacturer": "National Industries Ltd", "standard": "IS 4151:2015", "valid_until": "2027-03-31"}
    elif name == "verify_huid":
        huid = args.get("huid", "").upper()
        return {"status": "ok", "valid": True, "huid": huid, "purity": "22K916 (91.6% Pure Gold)", "centre": "BIS Assaying & Hallmarking Centre, Mumbai", "status": "Operative"}
    elif name == "check_qco_compliance":
        p = args.get("product_name", "").lower()
        covered = any(k in p for k in ["helmet", "steel", "cement", "toy", "water", "cable", "wire", "valve"])
        return {"status": "ok", "covered": covered, "mandatory_scheme": "Scheme-I (ISI Mark)" if covered else "Voluntary", "note": "Mandatory BIS certification required under Gazette QCO" if covered else "Currently voluntary"}
    elif name == "find_testing_labs":
        return {"status": "ok", "labs": [{"name": "BIS Central Laboratory", "city": "Sahibabad / Delhi NCR", "scope": "All Electrical and Mechanical standards"}, {"name": "National Test House", "city": "Mumbai", "scope": "Civil, Mechanical, and Chemical testing"}]}
    elif name == "end_call":
        if call_id in CALLS:
            CALLS[call_id]["should_end"] = True
        return {"status": "ok"}
    return {"status": "ok"}

SYSTEM_PROMPT = """
You are "BISVEDA" (बिसवेदा), a warm, helpful, and knowledgeable AI voice assistant for the Bureau of Indian Standards (BIS).
You are speaking on a live phone call with an Indian citizen or business owner inquiring about Indian Standards, product certification, ISI marks, or gold hallmarking.

CONVERSATIONAL RULES:
1. When the call starts, greet the caller warmly in Hindi first, then in English:
   "Namaste! BISVEDA AI Helpline mein aapka swagat hai. Welcome to BISVEDA. Aap Hindi, English, ya kisi bhi bhasha mein sawaal pooch sakte hain."
2. Listen carefully to the user and continue in their preferred language (Hindi, English, Hinglish, Marathi, etc.).
3. Keep sentences concise, clear, and easy to understand over the phone (1-2 sentences per turn).
4. Use your tools when asked about standards, ISI marks, hallmarking HUID, testing labs, or QCO compliance!
5. After answering, ask: "Kya aapka koi aur sawaal hai?"
6. If the user is finished, say a warm goodbye out loud before calling end_call.
"""

app = FastAPI(title="BISVEDA Voice Bridge")

TWILIO_STREAM_URL = ""
TWILIO_TWIML_URL = ""

@app.api_route("/bisveda/twiml", methods=["GET", "POST"])
async def bisveda_twiml(request: Request):
    """Serve TwiML instructing Twilio to open bidirectional Media Stream."""
    stream_url = globals().get("TWILIO_STREAM_URL", "")
    response = VoiceResponse()
    connect = Connect()
    connect.stream(url=stream_url)
    response.append(connect)
    log.info(f"TwiML requested. Connecting stream to: {stream_url}")
    return Response(content=str(response), media_type="application/xml")

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "BISVEDA AI Voice Assistant",
        "model": GEMINI_MODEL,
        "twiml_url": TWILIO_TWIML_URL,
        "stream_url": TWILIO_STREAM_URL,
    }

@app.websocket("/bisveda/media")
async def bisveda_media(websocket: WebSocket):
    await websocket.accept()
    call_id = "call_" + str(int(time.time()))
    stream_sid = None
    CALLS[call_id] = {"should_end": False}
    log.info(f"[{call_id}] Twilio WebSocket connected!")

    try:
        async with gemini_client.aio.live.connect(
            model=GEMINI_MODEL,
            config=types.LiveConnectConfig(
                response_modalities=["AUDIO"],
                system_instruction=SYSTEM_PROMPT,
                tools=TOOLS,
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Aoede")
                    )
                ),
            ),
        ) as gemini:
            log.info(f"[{call_id}] Gemini Live session connected!")

            # Trigger opening greeting immediately so caller hears voice as soon as they answer
            await gemini.send_client_content(
                turns={
                    "role": "user",
                    "parts": [{"text": "The caller has answered the call. Please greet them warmly in Hindi first and then in English as instructed, and invite their question."}],
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
                            # Handle tool calls
                            tool_call = getattr(response, "tool_call", None)
                            if tool_call and getattr(tool_call, "function_calls", None):
                                f_resps = []
                                for fc in tool_call.function_calls:
                                    res = execute_tool_call(call_id, fc.name, dict(fc.args or {}))
                                    f_resps.append(types.FunctionResponse(id=fc.id, name=fc.name, response=res))
                                try:
                                    await gemini.send_tool_response(function_responses=f_resps)
                                except Exception as e:
                                    log.error(f"[{call_id}] Tool response error: {e}")

                            server_content = getattr(response, "server_content", None)
                            if not server_content:
                                continue

                            # Handle barge-in
                            if getattr(server_content, "interrupted", False):
                                await websocket.send_text(json.dumps({
                                    "event": "clear",
                                    "streamSid": stream_sid,
                                }))
                                log.info(f"[{call_id}] Barge-in detected: cleared playback buffer")

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
                        log.error(f"[{call_id}] Gemini loop exception: {e}")
                        await asyncio.sleep(0.5)

                    if CALLS.get(call_id, {}).get("should_end"):
                        log.info(f"[{call_id}] Closing call after farewell")
                        try:
                            await websocket.close()
                        except Exception:
                            pass
                        return

            await asyncio.gather(twilio_to_gemini(), gemini_to_twilio())

    except WebSocketDisconnect:
        log.info(f"[{call_id}] Twilio disconnected")
    except Exception as e:
        log.error(f"[{call_id}] Session exception: {e}")
    finally:
        AUDIO_STATE.pop(call_id, None)
        CALLS.pop(call_id, None)

def sync_bridge_config(twiml_url: str, stream_url: str):
    """Write active URLs to prototype/.voice_bridge.json so Next.js reads it instantly."""
    data = {
        "active": True,
        "twiml_url": twiml_url,
        "stream_url": stream_url,
        "port": PORT,
        "updated_at": time.time(),
    }
    paths = [
        os.path.join("prototype", ".voice_bridge.json"),
        ".voice_bridge.json",
    ]
    for p in paths:
        try:
            with open(p, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            log.info(f"Synced bridge config to {p}")
        except Exception as e:
            log.warn(f"Could not write {p}: {e}")

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

    sync_bridge_config(TWILIO_TWIML_URL, TWILIO_STREAM_URL)

    print("\n" + "=" * 65)
    print("🚀 BISVEDA VOICE ASSISTANT — TWILIO + GEMINI LIVE BRIDGE ACTIVE")
    print("=" * 65)
    print(f"Public HTTPS URL  : {public_url}")
    print(f"Twilio WSS URL    : {TWILIO_STREAM_URL}")
    print(f"Twilio TwiML URL  : {TWILIO_TWIML_URL}")
    print(f"Caller Phone No   : {TWILIO_PHONE_NUMBER}")
    print(f"Verified Number   : {MY_PHONE_NUMBER}")
    print("=" * 65 + "\n")

    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="warning")
