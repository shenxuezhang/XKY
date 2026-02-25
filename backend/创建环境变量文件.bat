@echo off
chcp 65001 >nul
echo ========================================
echo 创建环境变量配置文件 (.env)
echo ========================================
echo.

cd /d "%~dp0"

if exist .env (
    echo [警告] .env 文件已存在！
    echo.
    set /p confirm="是否覆盖现有文件？(Y/N): "
    if /i not "%confirm%"=="Y" (
        echo 已取消操作
        pause
        exit /b 0
    )
)

echo 正在创建 .env 文件...
echo.

(
echo # 服务器配置
echo PORT=3000
echo NODE_ENV=development
echo CORS_ORIGIN=http://localhost:8080
echo.
echo # WPS开发者平台配置
echo WPS_APP_ID=SX20260116BGWQNH
echo WPS_APP_SECRET=sXXxtSbxGbxjKzqKGFtrBxHQQfUIJnKJ
echo WPS_REDIRECT_URI=http://localhost:3000/api/wps/callback
echo.
echo # 前端地址（用于OAuth回调重定向）
echo FRONTEND_URL=http://localhost:8080
) > .env

if exist .env (
    echo [成功] .env 文件已创建！
    echo.
    echo 文件位置: %cd%\.env
    echo.
    echo 配置内容:
    echo ----------------------------------------
    type .env
    echo ----------------------------------------
    echo.
    echo [提示] 请确认配置信息是否正确
    echo [提示] 如需修改，请直接编辑 .env 文件
) else (
    echo [错误] .env 文件创建失败！
)

echo.
pause
