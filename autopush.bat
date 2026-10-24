
@echo off
echo === NGORK Auto Push ===
git add .
git commit -m "Update NGORK"
if errorlevel 1 (
    echo No changes to commit, or commit failed.
    pause
    exit /b 1
)
git push
if errorlevel 1 (
    echo Push failed. Please check GitHub authentication or branch settings.
    pause
    exit /b 1
)
echo Push completed!
pause
