@echo off
chcp 65001 >nul
echo ========================================
echo eMAG市场海选系统 - 后端服务器启动脚本
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] 检查Node.js环境...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到Node.js，请先安装Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

node --version
echo.

echo [2/3] 检查依赖包...
if not exist "node_modules" (
    echo [提示] 首次运行，正在安装依赖包...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖包安装失败
        pause
        exit /b 1
    )
    echo.
)

echo [2.5/3] 检查dotenv包...
call npm list dotenv >nul 2>&1
if %errorlevel% neq 0 (
    echo [提示] dotenv包未安装，正在安装...
    call npm install dotenv
    if %errorlevel% neq 0 (
        echo [错误] dotenv安装失败
        pause
        exit /b 1
    )
    echo.
)

echo [3/4] 检查环境变量文件...
if not exist ".env" (
    echo [警告] .env 文件不存在！
    echo [提示] 请先运行"创建环境变量文件.bat"创建.env文件
    echo.
    set /p continue="是否继续启动服务器？(Y/N): "
    if /i not "!continue!"=="Y" (
        echo 已取消启动
        pause
        exit /b 0
    )
    echo.
) else (
    echo [成功] .env 文件已存在
    echo.
)

echo [4/4] 启动后端服务器...
echo.
echo ========================================
echo 服务器启动中...
echo 访问地址: http://localhost:3000
echo API测试: http://localhost:3000/api/wps/auth-url
echo 按 Ctrl+C 停止服务器
echo ========================================
echo.

node server.js

pause
