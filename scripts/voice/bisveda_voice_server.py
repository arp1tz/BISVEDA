"""
BISVEDA Real-time Voice Call Assistant — Exotel + Gemini Live Runner
Starts the FastAPI bridge, mounts ngrok tunnel, registers BISVEDA tools,
and connects bidirectional Exotel telephony audio (8kHz PCM16) to Gemini Live (gemini-3.1-flash-live-preview).
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

def get_env(key, default=""):
    return os.environ.get(key, default)

# ── Credentials & Configuration ──
GEMINI_API_KEY = get_env("VOICE_GEMINI_API_KEY") or get_env("GEMINI_API_KEY", "AQ.Ab8RN6JrOHqgvRTeVBWciSg1P4LcTEuVq6lDEh7tF0EctC-1Mw")
GEMINI_MODEL = get_env("VOICE_GEMINI_MODEL", "gemini-3.1-flash-live-preview")

EXOTEL_ACCOUNT_SID = get_env("EXOTEL_ACCOUNT_SID", "none6723")
EXOTEL_API_KEY = get_env("EXOTEL_API_KEY", "90b2ea024e1f7ec958f6a3bf1d775952604fa5d65c64d90f")
EXOTEL_API_TOKEN = get_env("EXOTEL_API_TOKEN", "b9e9b63bd4e658fa6eb5562a70a30433e900b2f4adc4ae23")
EXOTEL_CALLER_ID = get_env("EXOTEL_CALLER_ID", "01414939968")
EXOTEL_APP_ID = get_env("EXOTEL_APP_ID", "1349660")
MY_PHONE_NUMBER = get_env("MY_PHONE_NUMBER", "9529512485")

NGROK_AUTHTOKEN = get_env("NGROK_AUTHTOKEN", "3JuYjB10Je24Y4vDMc7nmD8yvqk_6EvETNmVk772rHuTkJVLV")
PORT = int(get_env("VOICE_PORT", "8001"))

EXOTEL_SAMPLE_RATE = 8000
EXOTEL_CHANNELS = 1
OUTGOING_CHUNK_BYTES = 1600  # 100ms at 8kHz 16-bit mono (5 * 320 bytes)

# Audio state buffer per call
AUDIO_STATE = {}
CALLS = {}
ACTIVE_CALLS = {}

def _audio_state(call_id: str):
    return AUDIO_STATE.setdefault(
        call_id,
        {"in": None, "out": None, "out_buffer": bytearray()},
    )

def exotel_to_gemini_pcm16(payload_b64: str, call_id: str) -> bytes:
    """Exotel 8 kHz raw PCM16 -> Gemini 16 kHz raw PCM16."""
    raw_pcm8k = base64.b64decode(payload_b64)
    if len(raw_pcm8k) % 2:
        raw_pcm8k = raw_pcm8k[:-1]
    state = _audio_state(call_id)
    pcm16k, state["in"] = audioop.ratecv(
        raw_pcm8k, 2, EXOTEL_CHANNELS,
        EXOTEL_SAMPLE_RATE, 16000,
        state["in"],
    )
    return pcm16k

def gemini_to_exotel_chunks(pcm24k: bytes, call_id: str, flush=False):
    """Gemini 24 kHz PCM16 -> buffered 8 kHz PCM16 base64 chunks."""
    state = _audio_state(call_id)
    if pcm24k:
        if len(pcm24k) % 2:
            pcm24k = pcm24k[:-1]
        pcm8k, state["out"] = audioop.ratecv(
            pcm24k, 2, 1,
            24000, EXOTEL_SAMPLE_RATE,
            state["out"],
        )
        state["out_buffer"].extend(pcm8k)

    chunks = []
    while len(state["out_buffer"]) >= OUTGOING_CHUNK_BYTES:
        chunk = bytes(state["out_buffer"][:OUTGOING_CHUNK_BYTES])
        del state["out_buffer"][:OUTGOING_CHUNK_BYTES]
        chunks.append(base64.b64encode(chunk).decode("ascii"))

    if flush and state["out_buffer"]:
        remaining = bytes(state["out_buffer"])
        pad_to = max(320, ((len(remaining) + 319) // 320) * 320)
        remaining += b"\x00" * (pad_to - len(remaining))
        state["out_buffer"].clear()
        chunks.append(base64.b64encode(remaining).decode("ascii"))

    return chunks

def clear_audio_state(call_id: str):
    AUDIO_STATE.pop(call_id, None)

# ── Gemini Client ──
gemini_client = genai.Client(api_key=GEMINI_API_KEY)

# ── BIS Mock Database & Tools ──
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
            description="Search the BIS standards database by keywords, product name, or standard number (e.g., 'steel tubes', 'IS 4151', 'drinking water').",
            parameters={"type": "OBJECT", "properties": {"query": {"type": "STRING", "description": "Search query keywords"}}, "required": ["query"]},
        ),
        types.FunctionDeclaration(
            name="verify_isi_mark",
            description="Verify whether an ISI Mark CM/L licence number is genuine and active (e.g., 'CM/L-1234567').",
            parameters={"type": "OBJECT", "properties": {"cm_l_number": {"type": "STRING", "description": "The CM/L licence number"}}, "required": ["cm_l_number"]},
        ),
        types.FunctionDeclaration(
            name="verify_huid",
            description="Verify Hallmark Unique Identification (HUID) 6-character code on gold jewellery.",
            parameters={"type": "OBJECT", "properties": {"huid": {"type": "STRING", "description": "6-character alphanumeric HUID"}}, "required": ["huid"]},
        ),
        types.FunctionDeclaration(
            name="check_qco_compliance",
            description="Check whether a product falls under mandatory Quality Control Order (QCO).",
            parameters={"type": "OBJECT", "properties": {"product_name": {"type": "STRING", "description": "Product name in English"}}, "required": ["product_name"]},
        ),
        types.FunctionDeclaration(
            name="find_testing_labs",
            description="Find BIS recognized testing laboratories by product or city/state.",
            parameters={"type": "OBJECT", "properties": {"product_or_standard": {"type": "STRING", "description": "Product or standard"}, "location": {"type": "STRING", "description": "City or state"}}, "required": ["product_or_standard"]},
        ),
        types.FunctionDeclaration(
            name="end_call",
            description="End the phone call after speaking a polite closing goodbye out loud to the caller.",
            parameters={"type": "OBJECT", "properties": {"reason": {"type": "STRING", "description": "Reason for ending"}}},
        ),
    ])
]

def execute_tool_call(call_id: str, name: str, args: dict):
    log.info(f"[{call_id}] Tool Call: {name}({args})")
    if name == "search_standards":
        q = str(args.get("query", "")).upper()
        matches = [s for is_num, s in MOCK_STANDARDS.items() if q in is_num or any(w in s["title"].upper() or w in s["scope"].upper() for w in q.split())]
        if not matches:
            matches = list(MOCK_STANDARDS.values())[:2]
        return {"status": "ok", "count": len(matches), "standards": matches[:3]}
    elif name == "verify_isi_mark":
        cml = str(args.get("cm_l_number", ""))
        return {"status": "ok", "valid": True, "cm_l": cml, "manufacturer": "National Industries Ltd", "standard": "IS 4151:2015", "valid_until": "2027-03-31"}
    elif name == "verify_huid":
        huid = str(args.get("huid", "")).upper()
        return {"status": "ok", "valid": True, "huid": huid, "purity": "22K916 (91.6% Pure Gold)", "centre": "BIS Assaying & Hallmarking Centre", "status": "Operative"}
    elif name == "check_qco_compliance":
        p = str(args.get("product_name", "")).lower()
        covered = any(k in p for k in ["helmet", "steel", "cement", "toy", "water", "cable", "wire", "valve"])
        return {"status": "ok", "covered": covered, "mandatory_scheme": "Scheme-I (ISI Mark)" if covered else "Voluntary", "note": "Mandatory BIS certification required under Gazette QCO" if covered else "Currently voluntary"}
    elif name == "find_testing_labs":
        return {"status": "ok", "labs": [{"name": "BIS Central Laboratory", "city": "Sahibabad / Delhi NCR", "scope": "Electrical, Mechanical, Chemical"}, {"name": "National Test House", "city": "Mumbai", "scope": "Civil, Mechanical, and Chemical testing"}]}
    elif name == "end_call":
        if call_id in CALLS:
            CALLS[call_id]["should_end"] = True
        return {"status": "ok"}
    return {"status": "ok"}

SYSTEM_PROMPT = """
You are "BISVEDA" (बिसवेदा), a warm, helpful, and highly knowledgeable AI voice assistant for the Bureau of Indian Standards (BIS), Ministry of Consumer Affairs, Government of India.
You are speaking live over a phone call with an Indian citizen, consumer, or MSME business owner.

CONVERSATIONAL RULES:
1. The caller has answered the phone. Greet them warmly and naturally in Hindi first, followed by English:
   "Namaste! BISVEDA AI Helpline mein aapka swagat hai. Welcome to the Bureau of Indian Standards AI helpline. Aap Hindi, English, ya kisi bhi bhasha mein sawaal pooch sakte hain. How can I help you today?"
2. Listen carefully to the user and seamlessly switch to their preferred language (Hindi, English, Hinglish, Marathi, etc.).
3. Keep spoken replies short, natural, and crisp (1-2 sentences per turn), ideal for voice phone calls.
4. When asked about Indian standards, ISI marks, gold hallmark HUID, testing labs, or mandatory QCO compliance, ALWAYS use the relevant tool to provide factual answers.
5. After answering a question, ask: "Kya aapka koi aur sawaal hai?" or "Would you like to check anything else?"
6. If the user is satisfied and says thank you/bye, say a warm, polite closing goodbye before ending the call.
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

        CALLS[call_id] = {"should_end": False, "phone": phone}
        ACTIVE_CALLS[call_id] = {"stream_sid": stream_sid, "phone": phone, "started_at": started_at}

        log.info(f"[{call_id}] EXOTEL_START verified | stream_sid={stream_sid} | phone={phone}")

        # Connect to Gemini Live
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

            # ── Exotel -> Gemini (Caller audio) ──
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
                                if in_packets == 1:
                                    log.info(f"[{call_id}] Caller audio started streaming in")
                                # Resample 8kHz PCM16 -> 16kHz PCM16 for Gemini
                                pcm16k = exotel_to_gemini_pcm16(payload, call_id)
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

            # ── Gemini -> Exotel (AI spoken response + tool execution) ──
            async def gemini_to_exotel():
                nonlocal stream_sid, call_id
                out_packets = 0
                try:
                    async for response in gemini.receive():
                        server_content = getattr(response, "server_content", None)
                        tool_call = getattr(response, "tool_call", None)

                        # Handle Tool Calls
                        if tool_call and getattr(tool_call, "function_calls", None):
                            function_responses = []
                            for fc in tool_call.function_calls:
                                args = dict(fc.args) if fc.args else {}
                                log.info(f"[{call_id}] Executing tool: {fc.name}")
                                res = execute_tool_call(call_id, fc.name, args)
                                function_responses.append(
                                    types.FunctionResponse(
                                        name=fc.name,
                                        id=fc.id,
                                        response=res,
                                    )
                                )

                            await gemini.send_tool_response(function_responses=function_responses)

                        # Handle Spoken Audio
                        if server_content and getattr(server_content, "model_turn", None):
                            for part in server_content.model_turn.parts:
                                inline_data = getattr(part, "inline_data", None)
                                if inline_data and getattr(inline_data, "data", None):
                                    chunks = gemini_to_exotel_chunks(inline_data.data, call_id)
                                    for payload in chunks:
                                        out_packets += 1
                                        if out_packets == 1:
                                            log.info(f"[{call_id}] First AI audio packet sent to caller!")
                                        await websocket.send_text(json.dumps({
                                            "event": "media",
                                            "stream_sid": stream_sid,
                                            "media": {"payload": payload},
                                        }))

                        if server_content and getattr(server_content, "turn_complete", False):
                            # Flush remaining buffer at turn end
                            flush_chunks = gemini_to_exotel_chunks(b"", call_id, flush=True)
                            for payload in flush_chunks:
                                await websocket.send_text(json.dumps({
                                    "event": "media",
                                    "stream_sid": stream_sid,
                                    "media": {"payload": payload},
                                }))
                            log.info(f"[{call_id}] Gemini turn complete (total out packets: {out_packets})")

                        # Handle call end request
                        if CALLS.get(call_id, {}).get("should_end"):
                            log.info(f"[{call_id}] Ending call as requested by assistant")
                            await asyncio.sleep(2.0)
                            try:
                                await websocket.close()
                            except Exception:
                                pass
                            return

                except Exception as e:
                    msg = str(e).lower()
                    if "1000" in msg or "closed" in msg or isinstance(e, asyncio.CancelledError):
                        log.info(f"[{call_id}] Gemini session ended cleanly")
                    else:
                        log.warn(f"[{call_id}] gemini_to_exotel error: {e}")

            # Start streaming loops first
            in_task = asyncio.create_task(exotel_to_gemini())
            out_task = asyncio.create_task(gemini_to_exotel())

            # Trigger opening greeting immediately while output receiver is listening!
            async def send_greeting():
                try:
                    await gemini.send_client_content(
                        turns={
                            "role": "user",
                            "parts": [{
                                "text": (
                                    "The caller has answered the call. Please speak your opening greeting out loud now: "
                                    "Greet them warmly in Hindi first and then in English as BISVEDA AI Helpline, "
                                    "and invite them to ask their question about Indian Standards, ISI marks, or gold hallmarking."
                                )
                            }],
                        },
                        turn_complete=True,
                    )
                    log.info(f"[{call_id}] Opening greeting instruction dispatched to Gemini")
                except Exception as ge:
                    log.error(f"[{call_id}] Failed to dispatch greeting: {ge}")

            asyncio.create_task(send_greeting())

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
    print("Ready to receive calls from Exotel or initiate outbound via Next.js portal.")

    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="warning")

if __name__ == "__main__":
    main()
