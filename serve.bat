@echo off
chcp 65001 >nul
cd /d "%~dp0"
setlocal enabledelayedexpansion

set PORT=3000
if not "%~1"=="" set PORT=%~1

echo ========================================
echo   S-ynapse Local Server (port %PORT%)
echo ========================================
echo.

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found. Please install Node.js first: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Stop only a LISTENING process that owns this TCP port
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /r /c:"LISTENING" ^| findstr /c":%PORT% "') do (
    taskkill /f /pid %%a >nul 2>&1
    if !errorlevel! equ 0 echo [OK] Stopped old process on port %PORT%
)

call :ensure_deps
if errorlevel 1 (
    echo.
    echo [ERROR] Dependency install failed. Please run "npm install" manually and retry.
    echo.
    pause
    exit /b 1
)

echo Starting server at: http://localhost:%PORT%/  (serve mode builds automatically)
echo Press Ctrl+C to stop.
echo.
call npm run serve -- --port %PORT%
set "SERVE_CODE=%ERRORLEVEL%"
echo.
echo [INFO] Server exited with code %SERVE_CODE%.
echo.
pause
exit /b %SERVE_CODE%

:ensure_deps
if exist "node_modules\sharp\package.json" exit /b 0
echo [INFO] Dependencies missing. Installing with npm install (no clean wipe)...
call npm install --no-audit --no-fund --prefer-offline
if errorlevel 1 exit /b 1
exit /b 0
