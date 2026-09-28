import json

with open('BISVEDA_VoiceCall_Exotel.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

# Update Cell 2
cell2_code = '''# 2. Configuration
#
# Loads API keys and Exotel credentials with safe environment/secret fallbacks.
# Gemini 3.1 Flash Live handles real-time audio + tool calling.

import os

def _get_secret(key, default=""):
    try:
        from kaggle_secrets import UserSecretsClient
        val = UserSecretsClient().get_secret(key)
        if val:
            return str(val)
    except Exception:
        pass
    try:
        from google.colab import userdata
        val = userdata.get(key)
        if val:
            return str(val)
    except Exception:
        pass
    return os.environ.get(key, default)

# ── Gemini ──
GEMINI_API_KEY = _get_secret("VOICE_GEMINI_API_KEY") or _get_secret("GEMINI_API_KEY") or "AQ.Ab8RN6JrOHqgvRTeVBWciSg1P4LcTEuVq6lDEh7tF0EctC-1Mw"
GEMINI_MODEL   = _get_secret("VOICE_GEMINI_MODEL", "gemini-3.1-flash-live-preview")

# ── Exotel Telephony ──
EXOTEL_ACCOUNT_SID = _get_secret("EXOTEL_ACCOUNT_SID", "none6723")
EXOTEL_API_KEY     = _get_secret("EXOTEL_API_KEY", "90b2ea024e1f7ec958f6a3bf1d775952604fa5d65c64d90f")
EXOTEL_API_TOKEN   = _get_secret("EXOTEL_API_TOKEN", "b9e9b63bd4e658fa6eb5562a70a30433e900b2f4adc4ae23")
EXOTEL_CALLER_ID   = _get_secret("EXOTEL_CALLER_ID", "01414939968")
EXOTEL_APP_ID      = _get_secret("EXOTEL_APP_ID", "1349660")
MY_PHONE_NUMBER    = _get_secret("MY_PHONE_NUMBER", "9529512485")

# ── Server / tunnel ──
PORT               = int(_get_secret("BISVEDA_VOICE_PORT", "8001"))
NGROK_AUTHTOKEN    = _get_secret("NGROK_AUTHTOKEN", "3JuYjB10Je24Y4vDMc7nmD8yvqk_6EvETNmVk772rHuTkJVLV")
EXOTEL_SAMPLE_RATE = 8000
EXOTEL_CHANNELS    = 1
EXOTEL_BIT_DEPTH   = 16

# ── Work directory & database ──
WORK_DIR = "/kaggle/working" if os.path.exists("/kaggle") else "."
os.makedirs(WORK_DIR, exist_ok=True)
DB_PATH        = os.path.join(WORK_DIR, "bisveda_voice.db")
LOG_FILE       = os.path.join(WORK_DIR, "bisveda_exotel_voice.log")
LOG_JSONL_FILE = os.path.join(WORK_DIR, "bisveda_exotel_voice.jsonl")

print("Configuration loaded successfully.")
print(f"Gemini model:       {GEMINI_MODEL}")
print(f"Exotel Account SID: {EXOTEL_ACCOUNT_SID}")
print(f"Exotel Caller ID:   {EXOTEL_CALLER_ID}")
print(f"My Phone Number:    {MY_PHONE_NUMBER}")
print(f"Exotel Audio:       {EXOTEL_SAMPLE_RATE} Hz / PCM16 mono")
'''
nb['cells'][2]['source'] = [line + '\n' for line in cell2_code.splitlines()]

# Update Cell 11 to define EXOTEL_STREAM_BASE consistently
cell11_code = '''# 11. Start ngrok tunnel

from pyngrok import ngrok

ngrok.set_auth_token(NGROK_AUTHTOKEN)

try:
    ngrok.kill()
except Exception:
    pass

tunnel = ngrok.connect(PORT, "http")
public_url = tunnel.public_url

if public_url.startswith("https://"):
    public_wss_url = "wss://" + public_url[len("https://"):]
elif public_url.startswith("http://"):
    public_wss_url = "wss://" + public_url[len("http://"):]
else:
    public_wss_url = public_url.replace("http://", "wss://")

EXOTEL_STREAM_BASE = public_wss_url + "/bisveda/media"
EXOTEL_WSS_URL     = EXOTEL_STREAM_BASE

print("=" * 70)
print("NGROK READY")
print("=" * 70)
print("Public HTTPS  :", public_url)
print("Exotel WSS    :", EXOTEL_STREAM_BASE)
print("=" * 70)
'''
nb['cells'][11]['source'] = [line + '\n' for line in cell11_code.splitlines()]

# Update Cell 12 to support both Outbound Call and Inbound Setup
cell12_code = '''# 12. Place an outbound call (for demo / testing)
#
# call_bisveda(phone_number) places an Exotel outbound call to your phone.
# When you answer, you immediately hear the BISVEDA greeting and can
# ask questions in Hindi, English, or any Indian language.

import requests

def call_bisveda(phone_number: str = None):
    """Place an outbound BISVEDA call via Exotel AgentStream."""
    phone = phone_number or MY_PHONE_NUMBER
    digits = "".join(filter(str.isdigit, str(phone)))
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]

    stream_url = f"{EXOTEL_STREAM_BASE}?sample-rate={EXOTEL_SAMPLE_RATE}"
    url = f"https://api.exotel.com/v1/Accounts/{EXOTEL_ACCOUNT_SID}/Calls/connect.json"

    payload = {
        "From": digits,
        "CallerId": EXOTEL_CALLER_ID,
        "StreamUrl": stream_url,
        "StreamType": "bidirectional",
    }

    print(f"Calling {digits} via Exotel...")
    response = requests.post(
        url,
        auth=(EXOTEL_API_KEY, EXOTEL_API_TOKEN),
        data=payload,
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    call_sid = data.get("Call", {}).get("Sid")
    print(f"Call placed successfully! Call SID: {call_sid}")
    print(f"Answer your phone ({digits}) to speak with BISVEDA AI.")
    return data

print("call_bisveda() ready — run call_bisveda(MY_PHONE_NUMBER) to place a live test call.")
'''
nb['cells'][12]['source'] = [line + '\n' for line in cell12_code.splitlines()]

# Update Cell 13 to demo call execution
cell13_code = '''# 13. Place the live demo call
#
# Run this cell to call your phone. When you pick up:
#   - Listen to the opening greeting
#   - Ask: "Mera ISI mark check karna hai — number hai CM/L-1234567"
#   - Ask: "Steel pipes ke liye kaunsa standard lagta hai?"
#   - Ask: "Is my gold hallmark real? HUID is AB1234CD"
#   - Ask: "Kya cement QCO ke under aata hai?"

call_bisveda(MY_PHONE_NUMBER)
'''
nb['cells'][13]['source'] = [line + '\n' for line in cell13_code.splitlines()]

with open('BISVEDA_VoiceCall_Exotel.ipynb', 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1)

print('Updated BISVEDA_VoiceCall_Exotel.ipynb successfully!')
