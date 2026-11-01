@echo off
title VISUE SPARK 2026 - Inter-University Programming Arena
color 0A
cls

echo ============================================================================
echo   ========================================================================
echo     ⚡ VISUE SPARK 2026 - INTER-UNIVERSITY PROGRAMMING ARENA
echo     CS-302: Advanced Web Technologies
echo   ========================================================================
echo ============================================================================
echo.
echo [*] Working Directory: D:\Study\Advanced Web Technologies\visue-spark-arena
cd /d "D:\Study\Advanced Web Technologies\visue-spark-arena"

echo [*] Freeing Port 3000 (clearing previous instances)...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

echo [*] Opening Chrome / Browser at http://localhost:3000 in 2 seconds...
start "" powershell -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:3000'"

echo [*] Starting Arena Engine (Node.js and Real-Time Socket.IO)...
echo.
echo ----------------------------------------------------------------------------
echo   🔑 SIR / JUDGE LOGIN CREDENTIALS:
echo      Judge Username: sir_visue
echo      Judge Password: spark2026
echo ----------------------------------------------------------------------------
echo.
echo Press [Ctrl + C] in this window anytime to stop the server.
echo.

node server.js

if %errorlevel% neq 0 (
    echo.
    echo [!] Server exited with an error code.
    pause
)
