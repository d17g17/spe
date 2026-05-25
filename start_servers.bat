@echo off
setlocal EnableDelayedExpansion
echo Starting Steam Profile App...
echo.

:: Check Node.js
echo Checking Node.js installation...
node --version 2>nul
if errorlevel 1 (
    echo ERROR: Node.js not found or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
echo Node.js found
echo.

:: Check directories
echo Checking project structure...
if not exist "server" (
    echo ERROR: server directory not found!
    pause
    exit /b 1
)
if not exist "client" (
    echo ERROR: client directory not found!
    pause
    exit /b 1
)
echo Project structure verified
echo.

:: Install server dependencies if needed
echo Checking server dependencies...
cd server
if not exist "node_modules" (
    echo Installing server dependencies...
    npm install
    if errorlevel 1 (
        echo ERROR: Failed to install server dependencies
        pause
        exit /b 1
    )
)
echo Server dependencies ready
cd ..

:: Install client dependencies if needed
echo Checking client dependencies...
cd client
if not exist "node_modules" (
    echo Installing client dependencies...
    npm install
    if errorlevel 1 (
        echo ERROR: Failed to install client dependencies
        pause
        exit /b 1
    )
)
echo Client dependencies ready
cd ..
echo.

:: Start servers
echo Starting server in background...
start /b cmd /c "cd /d "%~dp0server" && npm run dev"
echo Server started
echo.

echo Waiting 5 seconds for server to initialize...
timeout /t 5 /nobreak >nul
echo.

echo Starting client...
echo Press Ctrl+C to stop both servers
echo.
cd client
npm start

:: When client stops, cleanup processes
echo.
echo Stopping servers...
echo Terminating Node.js processes...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im npm.exe >nul 2>&1
echo Servers stopped.
echo.
echo Steam Profile App has been shut down.
pause
