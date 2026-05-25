@echo off
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo Python is not installed. Please install Python from https://python.org
    pause
    exit /b 1
)

pip install -r requirements.txt
python test_proxies.py
pause
