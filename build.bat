@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo   S-ynapse Builder
echo ========================================
echo.
call npm ci 2>nul
call npm run build
echo.
if %errorlevel% equ 0 (
    echo [OK] Build successful! Output: dist/
) else (
    echo [ERROR] Build failed. Check the logs above.
)
echo.
pause
