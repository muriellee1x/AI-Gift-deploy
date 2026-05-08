<h1 align="center">Gift Master — AI 礼物生成工具</h1>

<p align="center">灵感一到，礼物即成</p>

> [!IMPORTANT]
> ⚠️ **测试版声明**：本项目目前处于测试初期阶段，存在部分 bug 和不完善之处，正在快速迭代更新中。欢迎提反馈问题和需求！

---

## ✨ 功能特性

- 🎁 **原子化礼物管线** — 多模型/工作流/Agent协作，从灵感到成品礼物全自动流转
- 💥 **礼物裂变** — AI 分析礼物内容，裂变出风格统一、主题变体清晰的新礼物视频
- 🎨 **礼物换肤** — 给已有礼物换个新皮肤，1:1还原底子礼物的镜头调度和主体动效
- 🌼 **垂类管线** — 一句话直出可上线礼物资源包
- 🔄 **后处理流水线** — 礼物icon生成、视频扣绿等多种礼物后处理链路
- 📋 **任务记录** — 所有生成任务状态实时追踪，支持历史回溯
- ⚙️ **资源配置** — 在线配置 AI 服务 API Key 和 BA 房间，支持多服务商切换

---

## 🚀 快速开始

**唯一前提**：安装 [Docker Desktop](https://docs.docker.com/get-docker/)（Windows / macOS / Linux 均支持）

### 拉取预构建镜像

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

#### 升级到新版本

```bash
docker compose down -v
docker rmi ghcr.io/muriellee1x/ai-gift-deploy:latest
curl -O https://raw.githubusercontent.com/muriellee1x/AI-Gift-deploy/main/docker-compose.yml
docker compose up -d
```

> 升级后请**清空浏览器缓存**并重新登录，避免旧版本缓存导致异常。

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

启动后进入****（右侧导航 ⚙️）配置 AI 服务的 API Key，内置配置教程。


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
