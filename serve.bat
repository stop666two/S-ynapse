@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=3000
if not "%1"=="" set PORT=%1

echo ========================================
echo   S-ynapse Local Server
echo ========================================
echo.

:: Kill existing process on the port
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /c":%PORT% "') do (
    taskkill /f /pid %%a >nul 2>&1
    if !errorlevel! equ 0 echo [OK] Killed old process on port %PORT%
)
if exist dist\index.html (
    echo Starting server at: http://localhost:%PORT%/
    echo Press Ctrl+C to stop.
    echo.
    npm run serve -- --port %PORT%
) else (
    echo [INFO] No build found. Building first...
    echo.
    call npm run build
    echo.
    echo Starting server at: http://localhost:%PORT%/
    echo Press Ctrl+C to stop.
    echo.
    npm run serve -- --port %PORT%
)
pause
