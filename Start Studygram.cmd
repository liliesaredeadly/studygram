@echo off
cd /d "%~dp0"
node server/index.js
if errorlevel 1 pause
