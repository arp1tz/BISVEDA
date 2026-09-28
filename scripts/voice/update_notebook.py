import json

with open('BISVEDA_VoiceCall_Exotel.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

# Update Cell 7 with natural multilingual system prompt
cell7_code = '''# 7. BISVEDA Natural Multilingual System Prompt & Gemini Client
#
# Grounded in 22 Indian scheduled languages with first-class Marathi, Hindi,
# and English support. Direct conversational answers without repetitive loops.

gemini_client = genai.Client(api_key=GEMINI_API_KEY)

SYSTEM_PROMPT = """
You are "BISVEDA" (बिसवेदा), the official AI Voice Assistant for the Bureau of Indian Standards (BIS), Ministry of Consumer Affairs, Government of India.
You are speaking live on a phone call with an Indian citizen, consumer, or MSME business owner.

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
    "हो, नक्कीच! मी मराठीत बोलू शकतो. बीआयएस (BIS) मानके, आयएसआय मार्क किंवा सोन्याच्या हॉलमार्कबद्दल तुम्हाला काय माहिती हवी आहे?"
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

print("BISVEDA natural multilingual system prompt ready.")
'''
nb['cells'][7]['source'] = [line + '\n' for line in cell7_code.splitlines()]

# Update Cell 9 with Barge-In VAD and Exotel Clear event
cell9_code = '''# 9. Exotel AgentStream WebSocket bridge — Barge-In (VAD) + Multilingual Gemini Live
#
# Connects Exotel 8kHz PCM16 bidirectional audio stream directly to Gemini Live
# (gemini-3.1-flash-live-preview) with:
#   1. Automatic RMS-based Voice Activity Detection (VAD) for instant barge-in
#   2. Exotel `clear` playout buffer clearing when the user interrupts
#   3. Continuous multi-turn conversations across all caller turns

app = FastAPI(title="BISVEDA Exotel Voice Bridge")
ACTIVE_CALLS = {}
SPEECH_RMS_THRESHOLD = 900
CONSECUTIVE_VOICED_PACKETS = 2

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

    ai_is_speaking = True
    barge_in_active = False
    consecutive_speech_pkts = 0

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
                nonlocal ai_is_speaking, barge_in_active, consecutive_speech_pkts
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
                                raw_pcm8k = base64.b64decode(payload)
                                rms = audioop.rms(raw_pcm8k, 2) if raw_pcm8k else 0
                                pcm16k = exotel_to_gemini_pcm16(payload, call_id)

                                # Barge-in detection
                                if ai_is_speaking:
                                    if rms >= SPEECH_RMS_THRESHOLD:
                                        consecutive_speech_pkts += 1
                                    else:
                                        consecutive_speech_pkts = 0
                                    if consecutive_speech_pkts >= CONSECUTIVE_VOICED_PACKETS:
                                        ai_is_speaking = False
                                        barge_in_active = True
                                        consecutive_speech_pkts = 0
                                        clear_audio_state(call_id)
                                        await websocket.send_text(json.dumps({
                                            "event": "clear",
                                            "stream_sid": stream_sid,
                                        }))
                                        logger.info("BARGE_IN", f"Interruption detected (RMS {rms}) -> Cleared playout", call_id)
                                        await gemini.send_realtime_input(
                                            audio=types.Blob(data=pcm16k, mime_type="audio/pcm;rate=16000")
                                        )
                                else:
                                    await gemini.send_realtime_input(
                                        audio=types.Blob(data=pcm16k, mime_type="audio/pcm;rate=16000")
                                    )
                        elif event_type == "stop":
                            return
                except Exception:
                    return

            async def gemini_to_exotel():
                nonlocal ai_is_speaking, barge_in_active, consecutive_speech_pkts
                out_pkts = 0
                turn = 0
                while True:
                    turn += 1
                    try:
                        async for response in gemini.receive():
                            sc = getattr(response, "server_content", None)
                            if sc and getattr(sc, "model_turn", None):
                                if barge_in_active:
                                    continue
                                ai_is_speaking = True
                                for part in sc.model_turn.parts:
                                    inline = getattr(part, "inline_data", None)
                                    if inline and inline.data:
                                        if barge_in_active:
                                            continue
                                        chunks = gemini_to_exotel_chunks(inline.data, call_id)
                                        for p in chunks:
                                            if barge_in_active:
                                                break
                                            out_pkts += 1
                                            await websocket.send_text(json.dumps({
                                                "event": "media",
                                                "stream_sid": stream_sid,
                                                "media": {"payload": p},
                                            }))
                            if sc and getattr(sc, "turn_complete", False):
                                if not barge_in_active:
                                    flush = gemini_to_exotel_chunks(b"", call_id, flush=True)
                                    for p in flush:
                                        await websocket.send_text(json.dumps({
                                            "event": "media",
                                            "stream_sid": stream_sid,
                                            "media": {"payload": p},
                                        }))
                                ai_is_speaking = False
                                barge_in_active = False
                                consecutive_speech_pkts = 0
                                logger.info("TURN_COMPLETE", f"Turn {turn} complete | pkts={out_pkts}", call_id)
                    except Exception as e:
                        msg = str(e).lower()
                        if "1000" in msg or "closed" in msg or isinstance(e, asyncio.CancelledError):
                            break
                        await asyncio.sleep(0.05)

            out_task = asyncio.create_task(gemini_to_exotel())
            in_task = asyncio.create_task(exotel_to_gemini())

            # Trigger opening greeting
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
                logger.info("GREETING_TRIGGERED", "Opening greeting dispatched", call_id)
            except Exception as ge:
                logger.error("GREETING_ERROR", str(ge), call_id)

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

print('Updated BISVEDA_VoiceCall_Exotel.ipynb with barge-in & Indic multilingual prompt!')
