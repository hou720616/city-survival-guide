#!/bin/bash

set -e

PROJECT_DIR="/home/ubuntu/csg-project"
VENV_DIR="/home/ubuntu/venv"
API_DIR="$PROJECT_DIR/api"

echo "====================================="
echo "  城市求生指南 - 部署脚本"
echo "====================================="

echo ""
echo "[1/6] 更新系统包..."
sudo apt-get update -y
sudo apt-get install -y nginx supervisor python3-venv nodejs npm curl

echo ""
echo "[2/6] 设置项目目录..."
mkdir -p "$API_DIR/logs"

echo ""
echo "[3/6] 设置 Python 虚拟环境..."
python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install --upgrade pip
"$VENV_DIR/bin/pip" install -r "$API_DIR/requirements.txt"

echo ""
echo "[4/6] 构建前端..."
cd "$PROJECT_DIR"
# 安装 Node 版本管理器并使用更高版本的 Node（系统自带版本可能太旧）
if ! command -v nvm &> /dev/null; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm use 20
fi
npm install
npm run build

echo ""
echo "[5/6] 配置服务..."
# 删除 Ubuntu 默认 nginx 配置，避免 default_server 冲突抢占 80 端口
sudo rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf
sudo cp "$API_DIR/nginx.conf" /etc/nginx/conf.d/csg.conf
sudo cp "$API_DIR/supervisor.conf" /etc/supervisor/conf.d/csg-api.conf

# 确保日志目录权限
sudo chown -R ubuntu:ubuntu "$API_DIR/logs"

sudo systemctl restart nginx
sudo supervisorctl update
sudo supervisorctl start csg-api

echo ""
echo "====================================="
echo "  部署完成！"
echo ""
echo "  前端访问: http://124.220.65.144"
echo "  API接口:  http://124.220.65.144/api"
echo "  API文档:  http://124.220.65.144/api/docs"
echo "====================================="
echo ""
echo "提醒: 请编辑 $API_DIR/.env 填入 ZHIPUAI_API_KEY"
echo "然后执行: sudo supervisorctl restart csg-api"
