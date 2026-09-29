@echo off
title BISVEDA System Boot
cd /d "%~dp0"
python scripts\boot.py %*
if errorlevel 1 (
    echo.
    echo [ERROR] BISVEDA boot script exited with an error code.
    pause
)
