import json

with open('BISVEDA_VoiceCall_Exotel.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

# Update Cell 9 with continuous multi-turn receive loop
cell9_code = '''# 9. Exotel AgentStream WebSocket bridge — Continuous Multi-turn Gemini Live
#
# Connects Exotel 8kHz PCM16 bidirectional audio stream directly to Gemini Live
# (gemini-3.1-flash-live-preview) with automatic greeting and continuous multi-turn
# listening across the entire phone call.

app = FastAPI(title="BISVEDA Exotel Voice Bridge")
ACTIVE_CALLS = {}

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
        "stream_url": globals().get("EXOTEL_STREAM_BASE", ""),
        "active_calls": len(ACTIVE_CALLS),
    }

async def _read_until_start(websocket: WebSocket):
    while True:
        raw = await websocket.receive_text()
        try:
            event = json.loads(raw)
        except json.JSONDecodeError:
            continue
        event_type = event.get("event")
        if event_type == "connected":
            continue
        if event_type == "start":
            start = event.get("start") or {}
            stream_sid = event.get("stream_sid") or start.get("stream_sid")
            call_sid = start.get("call_sid") or stream_sid or f"call_{int(time.time())}"
            phone = start.get("from") or "unknown"
            return {"call_id": call_sid, "stream_sid": stream_sid, "phone": phone}
        if event_type == "stop":
            return None

@app.websocket("/bisveda/media")
async def bisveda_media(websocket: WebSocket):
    await websocket.accept()
    call_id = f"call_{int(time.time())}"
    started_at = time.time()

    try:
        start_info = await _read_until_start(websocket)
        if not start_info:
            await websocket.close()
            return

        call_id = start_info["call_id"]
        stream_sid = start_info["stream_sid"]
        phone = start_info["phone"]
        ACTIVE_CALLS[call_id] = {"stream_sid": stream_sid, "phone": phone, "started_at": started_at}
        logger.info("EXOTEL_START", f"stream_sid={stream_sid} | phone={phone}", call_id)

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
            logger.info("GEMINI_CONNECTED", "Gemini Live session connected", call_id)

            async def exotel_to_gemini():
                in_pkts = 0
                try:
                    while True:
                        raw = await websocket.receive_text()
                        try:
                            event = json.loads(raw)
                        except json.JSONDecodeError:
                            continue
                        event_type = event.get("event")
                        if event_type == "media":
                            payload = (event.get("media") or {}).get("payload")
                            if payload:
                                in_pkts += 1
                                pcm16k = exotel_to_gemini_pcm16(payload, call_id)
                                await gemini.send_realtime_input(
                                    audio=types.Blob(data=pcm16k, mime_type="audio/pcm;rate=16000")
                                )
                        elif event_type == "stop":
                            return
                except Exception:
                    return

            async def gemini_to_exotel():
                out_pkts = 0
                turn = 0
                while True:
                    turn += 1
                    try:
                        async for response in gemini.receive():
                            sc = getattr(response, "server_content", None)
                            if sc and getattr(sc, "model_turn", None):
                                for part in sc.model_turn.parts:
                                    inline = getattr(part, "inline_data", None)
                                    if inline and inline.data:
                                        chunks = gemini_to_exotel_chunks(inline.data, call_id)
                                        for p in chunks:
                                            out_pkts += 1
                                            await websocket.send_text(json.dumps({
                                                "event": "media",
                                                "stream_sid": stream_sid,
                                                "media": {"payload": p},
                                            }))
                            if sc and getattr(sc, "turn_complete", False):
                                flush = gemini_to_exotel_chunks(b"", call_id, flush=True)
                                for p in flush:
                                    await websocket.send_text(json.dumps({
                                        "event": "media",
                                        "stream_sid": stream_sid,
                                        "media": {"payload": p},
                                    }))
                                logger.info("TURN_COMPLETE", f"Turn {turn} complete | pkts={out_pkts}", call_id)
                    except Exception as e:
                        msg = str(e).lower()
                        if "1000" in msg or "closed" in msg or isinstance(e, asyncio.CancelledError):
                            break
                        await asyncio.sleep(0.05)

            in_task = asyncio.create_task(exotel_to_gemini())
            out_task = asyncio.create_task(gemini_to_exotel())

            # Trigger opening greeting
            async def send_greeting():
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
                logger.info("GREETING_TRIGGERED", "Opening greeting dispatched", call_id)

            asyncio.create_task(send_greeting())

            done, pending = await asyncio.wait(
                {in_task, out_task},
                return_when=asyncio.FIRST_COMPLETED,
            )
            for t in pending:
                t.cancel()

    except Exception as e:
        logger.error("BRIDGE_ERROR", str(e), call_id)
    finally:
        ACTIVE_CALLS.pop(call_id, None)
        clear_audio_state(call_id)
        logger.info("CALL_FINISHED", f"Duration: {round(time.time() - started_at, 1)}s", call_id)

print("Exotel AgentStream route registered: /bisveda/media")
'''
nb['cells'][9]['source'] = [line + '\n' for line in cell9_code.splitlines()]

with open('BISVEDA_VoiceCall_Exotel.ipynb', 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1)

print('Updated BISVEDA_VoiceCall_Exotel.ipynb cell 9 successfully!')
