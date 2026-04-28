<p align="center">
  <img src="public/banner.png" alt="Gift Master" width="600">
</p>

<h1 align="center">Gift Master — AI 礼物生成工具</h1>

<p align="center">灵感一到，礼物即成</p>

<p align="center">
  <a href="README_en.md">English</a> · <a href="https://github.com/muriellee1x/AI-Gift-deploy/issues">反馈问题</a>
</p>

> [!IMPORTANT]
> ⚠️ **测试版声明**：本项目目前处于测试初期阶段，存在部分 bug 和不完善之处，正在快速迭代更新中。欢迎提 Issue 反馈问题和需求！

---

## ✨ 功能特性

- 🎁 **原子化礼物管线** — 多模型协作，从灵感到成品全自动流转
- 💥 **礼物裂变** — AI 分析视频/图片素材，生成角色形象与视频内容
- 🎨 **礼物换肤** — 对已有礼物方案进行风格重绘与二次创作
- 🔄 **后处理流水线** — 视频拼接、配音、字幕等多种后处理链路
- 📋 **任务记录** — 所有生成任务状态实时追踪，支持历史回溯
- ⚙️ **资源配置** — 在线配置 AI 服务 API Key，支持多服务商切换
- 🌐 **多语言界面** — 中文 / 英文，右上角一键切换

---

## 🚀 快速开始

**唯一前提**：安装 [Docker Desktop](https://docs.docker.com/get-docker/)（Windows / macOS / Linux 均支持）

### 方式一：拉取预构建镜像（推荐，最简单）

无需克隆仓库，一条命令下载配置文件，另一条命令启动所有服务：

```bash
# 下载 docker-compose.yml
curl -O https://raw.githubusercontent.com/muriellee1x/AI-Gift-deploy/main/docker-compose.yml

# 启动所有服务（MySQL + Redis + MinIO + App）
docker compose up -d
```

等待约 1-2 分钟（首次需拉取镜像），看到以下横幅说明启动成功：

```
╔══════════════════════════════════════════════════╗
║           Gift Master is ready!                  ║
║                                                  ║
║  HTTP:  http://localhost:13000                   ║
╚══════════════════════════════════════════════════╝
```

打开浏览器访问 [http://localhost:13000](http://localhost:13000) 开始使用。

> [!WARNING]
> 本版本为体验版，`docker-compose.yml` 中的密钥均为公开默认值，**请勿用于生产环境**。生产部署请参考 [生产环境配置](#生产环境配置) 章节。

#### 升级到新版本

```bash
docker compose down -v
docker rmi ghcr.io/muriellee1x/ai-gift-deploy:latest
curl -O https://raw.githubusercontent.com/muriellee1x/AI-Gift-deploy/main/docker-compose.yml
docker compose up -d
```

> 升级后请**清空浏览器缓存**并重新登录，避免旧版本缓存导致异常。

---

### 方式二：克隆仓库 + 本地构建（完全控制）

```bash
git clone https://github.com/muriellee1x/AI-Gift-deploy.git
cd AI-Gift-deploy

# 使用本地 Dockerfile 构建并启动
docker compose -f docker-compose.yml up -d --build
```

更新版本：

```bash
git pull
docker compose down
docker compose up -d --build
```

---

### 方式三：本地开发模式（开发者）

```bash
git clone https://github.com/muriellee1x/AI-Gift-deploy.git
cd AI-Gift-deploy

# 1. 复制环境变量（npm install 之前必须完成）
cp .env.example .env
# 编辑 .env，填入你的 AI API Key
# NEXTAUTH_URL 默认已是 http://localhost:3000，无需修改

# 2. 安装依赖
npm install

# 3. 只启动基础设施（端口已映射到非标准端口，.env.example 已预设）
#    mysql:13306  redis:16379  minio:19000
docker compose up mysql redis minio -d

# 4. 初始化数据库（首次必须执行）
npx prisma db push

# 5. 启动开发服务器
npm run dev
```

> [!WARNING]
> 跳过 `npx prisma db push` 会导致所有数据库表不存在，启动后报错 `The table 'tasks' does not exist`。请务必先运行此命令再启动开发服务器。

开发服务器访问地址：[http://localhost:3000](http://localhost:3000)

---

## 🍎 Mac 兼容性

| 机型 | 架构 | 镜像 | 说明 |
|------|------|------|------|
| Apple Silicon（M1/M2/M3/M4） | arm64 | `linux/arm64` | 原生性能，自动选取 |
| Intel Mac | amd64 | `linux/amd64` | 原生性能，自动选取 |

- 端口 `13000 / 13306 / 16379 / 19000 / 19001 / 13010` 在 macOS 上均无系统冲突
- 卷映射 `./data` 和 `./docker-logs` 在 Docker Desktop 默认 file sharing 设置下正常工作
- 唯一要求：安装 [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)（Intel 版或 Apple Silicon 版均可）

---

## 🔧 API 配置

启动后进入**设置中心**（右侧导航 ⚙️）配置 AI 服务的 API Key，内置配置教程。

支持的服务商（可在设置中心查看完整列表）：

- 文本生成：OpenAI / Gemini / 其他兼容 OpenAI 格式的服务商
- 图片生成：Fal / Replicate / 其他图像 API
- 语音合成：各主流 TTS 服务商

---

## 🏭 生产环境配置

生产部署时，请在 `docker-compose.yml` 同级目录创建 `docker-compose.prod.yml`（已被 `.gitignore` 排除），覆盖以下关键变量：

```bash
# 生成强密钥（每个字段单独生成，不要复用）
openssl rand -hex 32
```

需要替换的字段：

| 字段 | 说明 |
|------|------|
| `MYSQL_ROOT_PASSWORD` | MySQL root 密码 |
| `MINIO_ROOT_PASSWORD` | MinIO 管理密码 |
| `NEXTAUTH_URL` | 你的实际访问域名，如 `https://yourdomain.com` |
| `NEXTAUTH_SECRET` | 随机 32 字节 hex |
| `CRON_SECRET` | 随机 32 字节 hex |
| `INTERNAL_TASK_TOKEN` | 随机 32 字节 hex |
| `API_ENCRYPTION_KEY` | 随机 32 字节 hex |

启动生产环境：

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 💡 HTTPS 支持（可选）

HTTP 模式下浏览器可能限制并发连接，导致页面卡顿。可安装 [Caddy](https://caddyserver.com/docs/install) 启用本地 HTTPS：

```bash
caddy run --config Caddyfile
```

然后访问 [https://localhost:1443](https://localhost:1443)

---

## 📦 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 15 + React 19 |
| 样式 | Tailwind CSS v4 |
| 数据库 | MySQL 8 + Prisma ORM |
| 队列 | Redis 7 + BullMQ |
| 存储 | MinIO（S3 兼容）|
| 认证 | NextAuth.js |
| 运行时 | Node.js 20 + Alpine |

---

## 🤝 参与方式

- 🐛 提交 [Issue](https://github.com/muriellee1x/AI-Gift-deploy/issues) 反馈 Bug
- 💡 提交 [Issue](https://github.com/muriellee1x/AI-Gift-deploy/issues) 提出功能建议

---

**Made with ❤️ by Gift Master Team**
