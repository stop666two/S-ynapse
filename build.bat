@echo off
chcp 65001 >nul
cd /d "%~dp0"
setlocal
echo ========================================
echo   S-ynapse Builder
echo ========================================
echo.
call :ensure_deps
if errorlevel 1 (
    echo.
    echo [ERROR] Dependency install failed. Please run "npm install" manually and retry.
    echo.
    pause
    exit /b 1
)
echo [INFO] Building... (this may take 1-3 minutes)
call npm run build
echo.
if errorlevel 1 (
    echo [ERROR] Build failed. Check the logs above.
) else (
    echo [OK] Build successful! Output: dist/
)
echo.
pause
exit /b 0

:ensure_deps
if exist "node_modules\sharp\package.json" exit /b 0
echo [INFO] Dependencies missing. Installing with npm install (no clean wipe)...
call npm install --no-audit --no-fund --prefer-offline
if errorlevel 1 exit /b 1
exit /b 0
