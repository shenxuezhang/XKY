@echo off
chcp 65001 >nul
echo ========================================
echo 安装 dotenv 依赖包
echo ========================================
echo.

cd /d "%~dp0"

echo 正在安装 dotenv...
call npm install dotenv

if %errorlevel% equ 0 (
    echo.
    echo [成功] dotenv 安装完成！
) else (
    echo.
    echo [错误] dotenv 安装失败，请检查网络连接和npm配置
)

echo.
pause
