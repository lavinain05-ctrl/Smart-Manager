@echo off
title Deploy D Block RWA to Live Website
color 0A
echo ========================================================
echo    DEPLOYING D BLOCK RWA TO LIVE FIREBASE HOSTING
echo ========================================================
echo.
echo Step 1: Building project bundle...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed! Please check errors above.
    pause
    exit /b %errorlevel%
)

echo.
echo Step 2: Authenticating with Firebase...
echo (If your browser opens, select lavinain05@gmail.com and click Allow)
call firebase login --reauth
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Firebase login failed or was cancelled.
    pause
    exit /b %errorlevel%
)

echo.
echo Step 3: Deploying files to live hosting...
call firebase deploy --only hosting
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Firebase deployment failed.
    pause
    exit /b %errorlevel%
)

echo.
echo ========================================================
echo    SUCCESS! LIVE WEBSITE DEPLOYED SUCCESSFULLY!
echo    Live URL: https://dblockrwaindraprastha.web.app
echo ========================================================
echo.
pause
