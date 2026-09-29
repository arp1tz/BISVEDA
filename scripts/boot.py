#!/usr/bin/env python
"""
BISVEDA All-in-One Boot Supervisor
===================================
Launches both the BISVEDA AI Voice Assistant Bridge (port 8001 + Exotel/ngrok)
and the Next.js Web Portal (port 3000) in a single unified process.

Usage:
    python scripts/boot.py
    or run: boot.bat (Windows)
    or run: ./boot.ps1 (PowerShell)
"""

import os
import sys
import time
import signal
import shutil
import subprocess
import threading
from typing import List, Optional

# ANSI Color Codes for terminal
RESET = "\033[0m"
BOLD = "\033[1m"
GREEN = "\033[32m"
CYAN = "\033[36m"
YELLOW = "\033[33m"
RED = "\033[31m"
MAGENTA = "\033[35m"

# Enable ANSI escape sequences on Windows console
if os.name == "nt":
    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32
        kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
    except Exception:
        pass

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PROTOTYPE_DIR = os.path.join(ROOT_DIR, "prototype")
VOICE_SCRIPT = os.path.join(ROOT_DIR, "scripts", "voice", "bisveda_voice_server.py")

processes: List[subprocess.Popen] = []
shutdown_event = threading.Event()

def log(tag: str, color: str, message: str):
    prefix = f"{color}{BOLD}[{tag}]{RESET} "
    for line in message.rstrip().splitlines():
        if line.strip():
            print(f"{prefix}{line}", flush=True)

def stream_output(proc: subprocess.Popen, tag: str, color: str):
    """Continuously stream stdout & stderr from child process with tag."""
    try:
        for line in iter(proc.stdout.readline, ""):
            if shutdown_event.is_set():
                break
            if line:
                log(tag, color, line)
    except Exception:
        pass

def find_npm() -> str:
    """Find npm executable on Windows or POSIX."""
    npm_path = shutil.which("npm.cmd") if os.name == "nt" else shutil.which("npm")
    if not npm_path:
        npm_path = shutil.which("npm")
    return npm_path or "npm"

def kill_process_tree(proc: subprocess.Popen):
    """Cleanly terminate a process and all its children on Windows/POSIX."""
    if proc.poll() is not None:
        return
    try:
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
        else:
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()
    except Exception:
        pass

def handle_shutdown(signum=None, frame=None):
    if shutdown_event.is_set():
        return
    shutdown_event.set()
    print()
    log("BOOT", YELLOW, "Shutting down BISVEDA services cleanly...")
    for p in processes:
        kill_process_tree(p)
    log("BOOT", GREEN, "All services stopped. Goodbye!")
    sys.exit(0)

def main():
    signal.signal(signal.SIGINT, handle_shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, handle_shutdown)

    # Header Banner
    print(f"\n{BOLD}{CYAN}========================================================================{RESET}")
    print(f"{BOLD}{GREEN}      BISVEDA — Bureau of Indian Standards AI Voice & Web System      {RESET}")
    print(f"{BOLD}{CYAN}========================================================================{RESET}")

    # Verify Paths
    if not os.path.exists(VOICE_SCRIPT):
        log("BOOT", RED, f"Error: Voice server script not found at {VOICE_SCRIPT}")
        sys.exit(1)
    if not os.path.exists(PROTOTYPE_DIR):
        log("BOOT", RED, f"Error: Prototype directory not found at {PROTOTYPE_DIR}")
        sys.exit(1)

    npm_bin = find_npm()

    log("BOOT", YELLOW, f"Root workspace : {ROOT_DIR}")
    log("BOOT", YELLOW, f"Python runtime : {sys.executable}")
    log("BOOT", YELLOW, f"Node/NPM       : {npm_bin}")
    log("BOOT", GREEN,  "Starting services concurrently...")

    # 1. Start Voice Server (FastAPI + Exotel + Gemini Live on port 8001)
    log("BOOT", CYAN, "Launching Voice Assistant Bridge (port 8001)...")
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    voice_proc = subprocess.Popen(
        [sys.executable, VOICE_SCRIPT],
        cwd=ROOT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        env=env,
    )
    processes.append(voice_proc)
    threading.Thread(target=stream_output, args=(voice_proc, "VOICE", CYAN), daemon=True).start()

    # Give voice bridge a moment to register tunnel and write .voice_bridge.json
    time.sleep(2)

    # 2. Start Next.js Portal (npm run dev in prototype/ on port 3000)
    log("BOOT", GREEN, "Launching Next.js Portal (http://localhost:3000)...")
    portal_proc = subprocess.Popen(
        [npm_bin, "run", "dev"],
        cwd=PROTOTYPE_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        env=os.environ.copy(),
    )
    processes.append(portal_proc)
    threading.Thread(target=stream_output, args=(portal_proc, "PORTAL", GREEN), daemon=True).start()

    # Status Dashboard
    time.sleep(2)
    print(f"\n{BOLD}{GREEN}------------------------------------------------------------------------{RESET}")
    print(f"{BOLD}  Active Services:{RESET}")
    print(f"  {CYAN}* Next.js Web Portal    :{RESET} http://localhost:3000")
    print(f"  {CYAN}* Voice Bridge (Exotel) :{RESET} http://localhost:8001")
    print(f"  {CYAN}* Helpline Health Check :{RESET} http://localhost:3000/api/helpline/call")
    print(f"{BOLD}{GREEN}------------------------------------------------------------------------{RESET}")
    print(f"{YELLOW}  Live logs are streaming below. Press Ctrl+C anytime to stop all services.{RESET}\n")

    # Monitor loop
    try:
        while not shutdown_event.is_set():
            time.sleep(0.5)
            for p in processes:
                if p.poll() is not None:
                    log("BOOT", RED, f"Process (PID {p.pid}) exited unexpectedly with code {p.returncode}")
                    handle_shutdown()
    except KeyboardInterrupt:
        handle_shutdown()

if __name__ == "__main__":
    main()
