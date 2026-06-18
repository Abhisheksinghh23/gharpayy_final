@echo off
echo ===================================================
echo   CLOUDFLARE DEPLOYMENT ASSISTANT
echo ===================================================
echo.
echo Step 1: Logging into Cloudflare...
echo (A browser window will open. Please click 'Allow')
echo.
call npx wrangler login
if %errorlevel% neq 0 (
    echo.
    echo Login failed! Make sure you authorized the login in the browser.
    pause
    exit /b %errorlevel%
)

echo.
echo Step 2: Deploying to Cloudflare...
echo.
call npx wrangler deploy
if %errorlevel% neq 0 (
    echo.
    echo Deployment failed! Please check the error above.
    pause
    exit /b %errorlevel%
)

echo.
echo ===================================================
echo   SUCCESS! Deployment complete.
echo   Please hard-refresh your browser (Ctrl + F5).
echo ===================================================
echo.
pause
