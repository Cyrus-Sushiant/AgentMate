@echo off
setlocal

cd /d "%~dp0"

where pnpm >nul 2>&1
if errorlevel 1 (
    echo pnpm not found. Install it with: npm install -g pnpm
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing dependencies...
    call pnpm install
    if errorlevel 1 (
        echo Failed to install dependencies.
        pause
        exit /b 1
    )
)

echo Starting AgentMate...
call pnpm dev

pause
