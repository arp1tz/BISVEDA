"""
BISVEDA Real-time Voice Call Assistant — Exotel + Gemini Live Runner
Starts the FastAPI bridge, mounts ngrok tunnel, and connects bidirectional
Exotel telephony audio (8kHz PCM16) directly to Gemini Live (gemini-3.1-flash-live-preview)
for low-latency, natural, multi-turn conversational assistance.
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
OUTGOING_CHUNK_BYTES = 1600  # 100ms at 8kHz 16-bit mono

# Audio state buffer per call
AUDIO_STATE = {}
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

# ── BIS Knowledge System Prompt ──
SYSTEM_PROMPT = """
You are "BISVEDA" (बिसवेदा), the official AI Voice Assistant for the Bureau of Indian Standards (BIS), Ministry of Consumer Affairs, Food & Public Distribution, Government of India.
You are speaking live on a telephone call with an Indian consumer, citizen, or MSME business owner.

CORE CONVERSATIONAL GUIDELINES:
1. Speak naturally, warmly, and concisely (1 to 2 sentences per turn). This is a voice phone call, so avoid long paragraphs, bullet lists, or markdown symbols.
2. In the opening greeting:
   "Namaste! BISVEDA AI Helpline mein aapka swagat hai. Welcome to the Bureau of Indian Standards AI helpline. Aap Hindi, English, ya apni kisi bhi bhasha mein sawaal pooch sakte hain. How can I help you today?"
3. Adapt seamlessly to the caller's language (Hindi, English, Hinglish, Marathi, Tamil, etc.).
4. After answering any query, politely invite the caller: "Kya aapka koi aur sawaal hai?" or "Is there anything else I can help you with?"
5. NEVER hang up or end the call prematurely. Always remain listening for the caller's next question until they say goodbye.

COMPREHENSIVE BIS KNOWLEDGE FOR IMMEDIATE ANSWERS:
- Two-Wheeler Helmets: Governed by IS 4151. Mandatory certification under the Two-Wheeler Helmets Quality Control Order (QCO). Selling non-ISI helmets is illegal.
- Gold Hallmarking: Governed by IS 1417. Mandatory for 14K, 18K, 20K, 22K (916), 23K, and 24K jewellery. Consists of 3 marks: BIS logo (triangle), purity grade (e.g., 22K916), and a 6-digit alphanumeric Hallmark Unique Identification (HUID) code.
- How to Verify Gold HUID: Open the official "BIS Care" mobile app, tap 'Verify HUID', and enter the 6-character alphanumeric code to see the jeweller name, assaying centre, and registration status.
- ISI Mark & CM/L Licence: Genuine ISI products display the ISI monogram with the Indian Standard number (e.g., IS 4151) on top and a 7 or 8 digit licence number (CM/L-XXXXXXX) at the bottom.
- How to Verify ISI Mark: Open the "BIS Care" app, tap 'Verify Licence Details (CM/L)', and enter the licence number to check manufacturer name, product, brand, and validity.
- Steel Pipes & Tubes: Governed by IS 1239 (mild steel tubes) and IS 1161 (structural steel tubes). Mandatory under Steel and Steel Products QCO.
- Packaged Drinking Water: Governed by IS 14543 (packaged drinking water) and IS 13428 (packaged natural mineral water). Both are strictly mandatory under Scheme-I ISI mark.
- Cement: Governed by IS 269 (Ordinary Portland Cement - 33, 43, 53 grade) and IS 1489 (Portland Pozzolana Cement). Compulsory certification under Cement QCO.
- Toys for Children: Governed by IS 9873 (mechanical, flammability, and heavy metal safety) and IS 15644 (electric toys). Mandatory under Toys (Quality Control) Order.
- Electrical Cables & Wires: Governed by IS 694 for PVC insulated cables.
- Quality Control Orders (QCO): Mandatory orders notified by the Central Government under the BIS Act, 2016 making BIS certification compulsory before manufacture, import, or domestic sale.
- Testing Laboratories: BIS has its Central Laboratory at Sahibabad (Ghaziabad / Delhi NCR), regional labs in Mumbai, Kolkata, Chennai, Chandigarh, and Guwahati, plus hundreds of BIS-recognized NABL accredited labs across India.
- Reporting Counterfeits / Complaints: Consumers can file complaints about counterfeit ISI marks, substandard products, or misleading claims directly on the "BIS Care" app or via the National Consumer Helpline (1915).
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

        ACTIVE_CALLS[call_id] = {"stream_sid": stream_sid, "phone": phone, "started_at": started_at}
        log.info(f"[{call_id}] EXOTEL_START verified | stream_sid={stream_sid} | phone={phone}")

        # Connect to Gemini Live Session
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

            # ── Exotel -> Gemini (Caller live voice audio) ──
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
                                elif in_packets % 100 == 0:
                                    log.info(f"[{call_id}] Inbound audio: {in_packets} packets received")

                                # Resample 8kHz PCM16 -> 16kHz PCM16 for Gemini Live
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

            # ── Gemini -> Exotel (Continuous Multi-turn Spoken Audio) ──
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

                            # Handle spoken audio streaming back from Gemini
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
                                # Flush remaining audio buffer at turn end
                                flush_chunks = gemini_to_exotel_chunks(b"", call_id, flush=True)
                                for payload in flush_chunks:
                                    await websocket.send_text(json.dumps({
                                        "event": "media",
                                        "stream_sid": stream_sid,
                                        "media": {"payload": payload},
                                    }))
                                log.info(f"[{call_id}] Turn {turn} completed (cumulative out packets: {out_packets}). Listening for caller...")

                    except Exception as e:
                        msg = str(e).lower()
                        if "1000" in msg or "closed" in msg or isinstance(e, asyncio.CancelledError):
                            log.info(f"[{call_id}] Gemini session ended cleanly")
                            break
                        else:
                            log.warn(f"[{call_id}] gemini_to_exotel error in turn {turn}: {e}")
                            await asyncio.sleep(0.05)

            # Start streaming loops
            in_task = asyncio.create_task(exotel_to_gemini())
            out_task = asyncio.create_task(gemini_to_exotel())

            # Trigger opening greeting immediately while receiver loop is active
            async def send_greeting():
                try:
                    await asyncio.sleep(0.2)
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
                    log.info(f"[{call_id}] Opening greeting instruction dispatched to Gemini Live")
                except Exception as ge:
                    log.error(f"[{call_id}] Failed to dispatch greeting: {ge}")

            asyncio.create_task(send_greeting())

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
