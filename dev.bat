@echo off
echo ========================================
echo   RUDO - Dev Server Restart
echo ========================================
echo.

:: Kill anything on port 3000
echo Killing processes on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: Regenerate Prisma client (picks up schema changes)
echo Generating Prisma client...
call npx prisma generate

:: Clear Next.js cache for a clean rebuild
echo Clearing Next.js cache...
if exist ".next" rmdir /s /q .next

:: Start dev server
echo.
echo Starting dev server on http://localhost:3000 ...
echo ========================================
call npx next dev -p 3000
