# 城市求生指南 (City Survival Guide)

AI 驱动的城市适应方案平台。为新移民提供租房建议、通勤规划、预算分析和避坑指南。

## 技术栈

| 层 | 技术 |
|---|------|
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite 6 |
| CSS | Tailwind CSS 3 + 自定义色板 |
| 状态管理 | Zustand |
| 路由 | React Router v7 |
| 地图 | 高德地图 JS API 2.0 |
| 图表 | ECharts |
| 后端框架 | FastAPI (Python) |
| AI | 智谱 GLM-4-Flash |
| 数据库 | SQLite (pitfalls.db) |
| 部署 | 腾讯云 Ubuntu + Nginx + Supervisor |

## 项目结构

```
CSGProject/
├── src/                          # 前端源码
│   ├── api/index.ts              # API 调用封装
│   ├── components/               # 可复用组件
│   │   ├── BubbleRise.tsx        # 首页气泡升起动画
│   │   ├── GlobalMap.tsx         # 全局高德地图实例
│   │   ├── Navbar.tsx            # 顶部导航栏
│   │   └── Footer.tsx            # 页脚
│   ├── pages/                    # 页面组件
│   │   ├── Home.tsx              # 首页（叙事 + CTA）
│   │   ├── Survey.tsx            # 生成方案问卷
│   │   ├── Result.tsx            # 方案结果展示
│   │   ├── Chat.tsx              # AI 顾问对话
│   │   └── Pitfalls.tsx          # 避坑指南（提交/浏览/删除）
│   ├── store/                    # Zustand 状态管理
│   │   ├── useAppStore.ts        # 应用全局状态（用户输入、方案、加载态）
│   │   └── useMapStore.ts        # 地图全局状态（实例、激活/休眠、标记管理）
│   ├── types/index.ts            # TypeScript 类型定义
│   ├── index.css                 # 全局样式 + 动画 + 组件类
│   └── main.tsx                  # 应用入口
├── api/                          # Python 后端
│   ├── main.py                   # FastAPI 入口
│   ├── routers/                  # 路由模块
│   │   ├── solution.py           # 方案生成 API
│   │   ├── chat.py               # AI 对话 API
│   │   ├── amap.py               # 高德地图数据代理
│   │   └── pitfall.py            # 避坑记录 CRUD
│   ├── services/                 # 业务逻辑
│   │   ├── ai_service.py         # AI 调用 & JSON 容错修复
│   │   ├── amap_service.py       # 高德 API 封装
│   │   └── pitfall_service.py    # 避坑数据服务
│   ├── models/                   # 数据模型
│   │   └── pitfall.py            # 避坑记录 SQLite 模型
│   ├── prompts/                  # AI 提示词模板
│   │   ├── solution_prompt.py    # 方案生成提示词
│   │   └── chat_prompt.py        # 对话提示词
│   ├── utils/logger.py           # 日志工具
│   ├── data/pitfalls.db          # SQLite 数据库
│   ├── .env.example              # 环境变量模板
│   └── requirements.txt          # Python 依赖
├── public/fonts/                 # 字体文件
│   ├── Lora-*.ttf                # 衬线字体（标题）
│   ├── WorkSans-*.ttf            # 无衬线字体（正文）
│   └── NothingYouCouldDo-*.ttf   # 手写字体（装饰）
├── tailwind.config.js            # Tailwind 配置 & 自定义色板
├── vite.config.ts                # Vite 配置 & API 代理
├── deploy.sh                     # 一键部署脚本
└── .trae/                        # Trae IDE 配置
    ├── skills/                   # 自动化 Skill 定义
    └── rules/前端风格.md         # 前端代码风格约束
```

## 快速开始

### 环境要求

- Node.js 18+
- Python 3.10+
- 高德地图 JS API Key
- 智谱 AI API Key

### 1. 克隆并配置环境变量

```bash
git clone <repo-url>
cd CSGProject

# 后端环境变量
cp api/.env.example api/.env
# 编辑 api/.env 填入 API Key
```

### 2. 安装前端依赖

```bash
npm install
```

### 3. 安装后端依赖

```bash
cd api
pip install -r requirements.txt
cd ..
```

### 4. 启动开发环境

**后端**（端口 8000）：
```bash
cd api
uvicorn main:app --reload
```

**前端**（端口 5173，API 自动代理到 8000）：
```bash
npm run dev
```

访问 http://localhost:5173

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动前端开发服务器 |
| `npm run build` | TypeScript 检查 + 生产构建 |
| `npm run preview` | 预览生产构建 |
| `npm run check` | 仅 TypeScript 类型检查 |
| `npm run lint` | ESLint 代码检查 |
| `uvicorn main:app --reload` | 启动后端（热重载） |
| `uvicorn main:app --host 0.0.0.0 --port 8000` | 启动后端（生产） |

## 部署

详细部署流程见 `.trae/skills/deploy-server/SKILL.md`。

快速一键部署：
```bash
bash deploy.sh
```

部署步骤概要：
1. 打包源码（排除 `node_modules`、`dist`、`api/data`）
2. 上传到腾讯云服务器 `124.220.65.144`
3. 解压覆盖（保留 `api/data` 数据库）
4. `npm run build` 构建前端
5. Supervisor 重启后端 `csg-api`
6. Nginx 重载

## SSH 连接服务器

```powershell
# 查看 Supervisor 配置
ssh -i "H:\test1_1\test1.pem" -o StrictHostKeyChecking=no ubuntu@124.220.65.144 "cat /etc/supervisor/conf.d/csg-api.conf"

# 编辑 Supervisor 配置（修改环境变量等）
ssh -t -i "H:\test1_1\test1.pem" -o StrictHostKeyChecking=no ubuntu@124.220.65.144 "sudo nano /etc/supervisor/conf.d/csg-api.conf"

# 查看后端日志
ssh -i "H:\test1_1\test1.pem" -o StrictHostKeyChecking=no ubuntu@124.220.65.144 "tail -50 /home/ubuntu/csg-project/api/logs/app.log"

# 重启后端服务
ssh -i "H:\test1_1\test1.pem" -o StrictHostKeyChecking=no ubuntu@124.220.65.144 "/usr/bin/sudo /usr/bin/supervisorctl restart csg-api"
```

## 环境变量

`api/.env`（本地开发用；服务器上未使用 .env 文件，通过 Supervisor `environment` 注入）：

| 变量 | 说明 |
|------|------|
| `AMAP_WEB_KEY` | 高德地图 Web 服务 API Key（源码有硬编码回退值） |
| `ZHIPUAI_API_KEY` | 智谱 AI API Key（服务器配置在 `/etc/supervisor/conf.d/csg-api.conf`） |
| `CORS_ORIGINS` | 允许跨域来源（逗号分隔） |

## 设计说明

- **色彩**：terracotta / sage / espresso / parchment 定制色板
- **字体**：Lora（标题）、Work Sans（正文）、Nothing You Could Do（手写装饰）
- **图标**：统一使用 lucide-react
- **地图**：通过 CSS 类切换 map-sleep / map-active / map-pitfalls / map-result 四种状态

完整前端风格约束见 `.trae/rules/前端风格.md`。
