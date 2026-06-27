# VoiceGo Backend - Quick Start
Write-Host "=== VoiceGo Backend ===" -ForegroundColor Cyan
Set-Location $PSScriptRoot
py -m pip install -r requirements.txt
Write-Host "Starting server on http://localhost:8000 ..." -ForegroundColor Green
py -m uvicorn main:app --reload --port 8000
