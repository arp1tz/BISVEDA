# BISVEDA System Boot Script (PowerShell)
$Host.UI.RawUI.WindowTitle = "BISVEDA System Boot"
Set-Location -Path $PSScriptRoot
python scripts/boot.py @args
