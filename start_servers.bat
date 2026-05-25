@echo off
setlocal
echo Starting Steam Profile Explorer...
where node >nul 2>nul || (echo ERROR: Node.js not found in PATH & pause & exit /b 1)

if not exist "node_modules" (
    echo Installing root dependencies...
    call npm install || (echo Root install failed & pause & exit /b 1)
)
if not exist "server\node_modules" (
    echo Installing server dependencies...
    call npm --prefix server install || (echo Server install failed & pause & exit /b 1)
)
if not exist "client\node_modules" (
    echo Installing client dependencies...
    call npm --prefix client install || (echo Client install failed & pause & exit /b 1)
)

echo.
echo Press Ctrl+C to stop both servers.
echo.
call npm run dev
endlocal
