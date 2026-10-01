@echo off
chcp 65001 >nul
cd /d "%~dp0"
setlocal

echo ========================================
echo   S-ynapse Builder
echo ========================================
echo.

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found. Please install Node.js first: https://nodejs.org
    echo.
    pause
    exit /b 1
)

call :ensure_deps
if errorlevel 1 (
    echo.
    echo [ERROR] Dependency install failed. Please run "npm install" manually and retry.
    echo.
    pause
    exit /b 1
)

echo [INFO] Building... (this may take 1-3 minutes)
echo.
call npm run build
set "BUILD_CODE=%ERRORLEVEL%"
echo.
if not "%BUILD_CODE%"=="0" (
    echo [ERROR] Build failed with exit code %BUILD_CODE%. Check the messages above.
    echo.
    pause
    exit /b %BUILD_CODE%
)
echo [OK] Build successful! Output: dist/
echo.
pause
exit /b 0

:ensure_deps
if exist "node_modules\sharp\package.json" exit /b 0
echo [INFO] Dependencies missing. Installing with npm install (no clean wipe)...
call npm install --no-audit --no-fund --prefer-offline
if errorlevel 1 exit /b 1
exit /b 0
