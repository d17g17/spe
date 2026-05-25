@echo off
echo Killing all Node.js instances...
taskkill /IM node.exe /F
if %ERRORLEVEL% EQU 0 (
    echo All Node.js instances terminated successfully.
) else (
    echo No Node.js instances found or error occurred.
)
pause
