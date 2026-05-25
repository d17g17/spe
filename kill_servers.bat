@echo off
echo Killing Node.js processes...
taskkill /f /im node.exe >nul 2>&1
echo Done.
