import json

def update_notebook():
    nb_path = "BISVEDA_VoiceCall_Twilio.ipynb"
    with open(nb_path, "r", encoding="utf-8") as f:
        nb = json.load(f)

    # 1. Update Cell 7: GeminiLiveSession
    c7_str = "".join(nb["cells"][7]["source"])
    
    target_7 = """        # Kick off the greeting immediately so the caller hears something
        # right away, rather than silence while Gemini waits for audio.
        await self.session.send_client_content(
            turns={
                "role": "user",
                "parts": [{
                    "text": (
                        "The caller has just answered the phone. Greet them "
                        "warmly in Hindi first and then in English as "
                        "instructed, then invite them to ask their question "
                        "in any language."
                    )
                }],
            },
            turn_complete=True,
        )
        return self"""

    replacement_7 = """        return self

    async def trigger_greeting(self):
        \"\"\"Send the opening greeting instruction once the telephony media stream is confirmed active.\"\"\"
        await self.session.send_client_content(
            turns={
                "role": "user",
                "parts": [{
                    "text": (
                        "The caller has just answered the phone and the media stream is active. Greet them "
                        "warmly in Hindi first and then in English as "
                        "instructed, then invite them to ask their question "
                        "in any language."
                    )
                }],
            },
            turn_complete=True,
        )"""

    if target_7 in c7_str:
        c7_str = c7_str.replace(target_7, replacement_7)
        nb["cells"][7]["source"] = [line + "\n" for line in c7_str.split("\n")]
        # strip last extra newline if added
        if nb["cells"][7]["source"] and nb["cells"][7]["source"][-1] == "\n":
            nb["cells"][7]["source"].pop()
        print("Cell 7 successfully updated.")
    else:
        print("Warning: target_7 not found in Cell 7 (may already be updated).")

    # 2. Update Cell 9: Twilio Media Streams bridge
    c9_str = "".join(nb["cells"][9]["source"])

    # Add stream_ready and pause(120) to twiml
    twiml_target = """    connect = Connect()
    connect.stream(url=stream_url)
    response.append(connect)
    logger.info("TWIML_SERVED", f"Returning stream TwiML for {stream_url}")"""

    twiml_replacement = """    connect = Connect()
    connect.stream(url=stream_url)
    response.append(connect)
    response.pause(length=120)
    logger.info("TWIML_SERVED", f"Returning stream TwiML for {stream_url}")"""

    if twiml_target in c9_str:
        c9_str = c9_str.replace(twiml_target, twiml_replacement)
        print("Cell 9 twiml response.pause updated.")

    # Add stream_ready = asyncio.Event() at beginning of bisveda_media
    media_target = """    call_id = "unknown"
    stream_sid = None
    started_at = time.time()"""

    media_replacement = """    call_id = "unknown"
    stream_sid = None
    stream_ready = asyncio.Event()
    started_at = time.time()"""

    if media_target in c9_str:
        c9_str = c9_str.replace(media_target, media_replacement)
        print("Cell 9 stream_ready event added.")

    # In twilio_to_gemini, set stream_ready when start event received
    start_target = """                        stream_sid = (
                            event.get("streamSid")
                            or start.get("streamSid")
                        )"""

    start_replacement = """                        stream_sid = (
                            event.get("streamSid")
                            or start.get("streamSid")
                        )
                        stream_ready.set()"""

    if start_target in c9_str:
        c9_str = c9_str.replace(start_target, start_replacement)
        print("Cell 9 stream_ready.set() wired into start event.")

    # In gemini_to_twilio, wait for stream_ready and trigger greeting
    gemini_wait_target = """                while True:
                    gemini_turns += 1
                    logger.info("GEMINI_WAIT", f"Turn {gemini_turns}", call_id)"""

    gemini_wait_replacement = """                logger.info("STREAM_WAIT", "Waiting for Twilio streamSid before starting conversation...", call_id)
                await stream_ready.wait()
                logger.info("STREAM_READY", f"Twilio streamSid active ({stream_sid}). Triggering greeting.", call_id)
                await gemini.trigger_greeting()

                while True:
                    gemini_turns += 1
                    logger.info("GEMINI_WAIT", f"Turn {gemini_turns}", call_id)"""

    if gemini_wait_target in c9_str:
        c9_str = c9_str.replace(gemini_wait_target, gemini_wait_replacement)
        print("Cell 9 gemini_to_twilio wait for stream_ready wired.")

    # Prevent infinite exception loop in gemini_to_twilio
    error_loop_target = """                    except Exception as e:
                        logger.error(
                            "GEMINI_ERROR",
                            f"{type(e).__name__}: {e}",
                            call_id,
                        )
                        logger.error(
                            "GEMINI_ERROR_TRACE",
                            traceback.format_exc(),
                            call_id,
                        )
                        await asyncio.sleep(0.5)"""

    error_loop_replacement = """                    except Exception as e:
                        if "1000" in str(e) or "closed" in str(e).lower() or isinstance(e, asyncio.CancelledError):
                            logger.info("GEMINI_CLEAN_CLOSE", "Gemini stream closed cleanly", call_id)
                            break
                        logger.error(
                            "GEMINI_ERROR",
                            f"{type(e).__name__}: {e}",
                            call_id,
                        )
                        break"""

    if error_loop_target in c9_str:
        c9_str = c9_str.replace(error_loop_target, error_loop_replacement)
        print("Cell 9 exception handling updated to prevent infinite 1000 loops.")

    nb["cells"][9]["source"] = [line + "\n" for line in c9_str.split("\n")]
    if nb["cells"][9]["source"] and nb["cells"][9]["source"][-1] == "\n":
        nb["cells"][9]["source"].pop()

    with open(nb_path, "w", encoding="utf-8") as f:
        json.dump(nb, f, indent=1)

    print("BISVEDA_VoiceCall_Twilio.ipynb updated successfully!")

if __name__ == "__main__":
    update_notebook()
