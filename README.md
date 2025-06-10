# SFTP Explorer

<div align="center">
  <h3>🚀 强大的 VS Code SFTP 文件浏览器插件</h3>
  <p>在 VS Code 中无缝管理远程服务器文件，提供完整的 SFTP 支持</p>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Visual Studio Marketplace](https://img.shields.io/badge/VS%20Code-Extension-blue.svg)](https://marketplace.visualstudio.com/items?itemName=sftp-explorer.sftp-explorer)
  [![GitHub issues](https://img.shields.io/github/issues/bochili/vscode-sftp-explorer)](https://github.com/bochili/vscode-sftp-explorer/issues)
  [![GitHub stars](https://img.shields.io/github/stars/bochili/vscode-sftp-explorer)](https://github.com/bochili/vscode-sftp-explorer/stargazers)
</div>

## ✨ 主要特性

### 🔗 SFTP连接支持

- **SFTP协议** - 安全文件传输协议，基于SSH
- **双重认证** - 支持密码和私钥认证
- **灵活配置** - 可配置端口和远程路径
- **安全可靠** - 所有传输数据加密保护

### 📁 完整的文件管理

- **浏览文件** - 树形结构显示远程文件系统
- **文件操作** - 创建、重命名、删除文件和文件夹
- **文件传输** - 上传/下载文件和文件夹
- **在线编辑** - 直接在 VS Code 中编辑远程文件
- **批量操作** - 支持多选文件进行批量操作

### 🎯 高级功能

- **搜索功能** - 支持通配符的远程文件搜索
- **剪贴板集成** - 复制、剪切、粘贴文件
- **拖拽操作** - 直观的拖拽文件管理
- **终端集成** - 直接打开 SSH 终端到指定目录
- **跨环境操作** - 本地与远程文件互传

### 🚀 用户体验

- **可视化状态** - 实时连接状态显示
- **进度追踪** - 文件传输进度可视化
- **错误处理** - 友好的错误提示和处理
- **快捷键支持** - 常用操作快捷键绑定

## 📦 安装

### 从 VS Code 市场安装

1. 打开 VS Code
2. 按 `Ctrl+Shift+X` 打开扩展市场
3. 搜索 "SFTP Explorer"
4. 点击安装

### 从 VSIX 文件安装

1. 下载最新的 `.vsix` 文件
2. 在 VS Code 中按 `Ctrl+Shift+P`
3. 输入 "Extensions: Install from VSIX"
4. 选择下载的 `.vsix` 文件

## 🚀 快速开始

### 1. 添加连接

1. 在侧边栏找到 "SFTP Explorer" 面板
2. 点击 `+` 按钮添加新连接
3. 填写服务器信息：
   - **连接名称**: 自定义连接名
   - **服务器地址**: 远程服务器IP或域名
   - **端口**: 默认22 (SFTP)
   - **用户名**: 服务器登录用户名
   - **认证方式**: 选择密码或私钥认证
   - **远程路径**: 默认连接目录
   - **协议**: SFTP

### 2. 连接服务器

1. 在连接列表中找到您的连接
2. 点击连接按钮 🔌
3. 等待连接建立

### 3. 开始管理文件

- **浏览**: 点击文件夹展开查看内容
- **编辑**: 双击文件直接在 VS Code 中编辑
- **上传**: 右键文件夹选择"上传文件"
- **下载**: 右键文件选择"下载文件"

## 📖 详细使用指南

### 连接管理

#### 密码认证配置

```json
{
  "name": "我的服务器",
  "host": "192.168.1.100",
  "port": 22,
  "username": "root",
  "password": "your_password",
  "remotePath": "/home/user",
  "protocol": "sftp"
}
```

#### 私钥认证配置（推荐）

```json
{
  "name": "我的服务器",
  "host": "192.168.1.100",
  "port": 22,
  "username": "root",
  "privateKeyPath": "/path/to/private/key",
  "remotePath": "/home/user",
  "protocol": "sftp"
}
```

### 文件操作

| 操作   | 快捷键             | 描述                     |
| ------ | ------------------ | ------------------------ |
| 重命名 | `F2`               | 重命名选中的文件或文件夹 |
| 删除   | `Delete`           | 删除选中的文件或文件夹   |
| 复制   | `Ctrl+C` / `Cmd+C` | 复制文件到剪贴板         |
| 剪切   | `Ctrl+X` / `Cmd+X` | 剪切文件到剪贴板         |
| 粘贴   | `Ctrl+V` / `Cmd+V` | 粘贴剪贴板中的文件       |

### 搜索功能

- 支持通配符 `*` 和 `?`
- 递归搜索子目录
- 实时显示搜索进度
- 快速定位搜索结果

### 终端集成

- 右键文件或文件夹选择"在终端中打开"
- 自动切换到对应目录
- 支持密码和私钥认证
- 保持SSH会话状态

## ⚙️ 配置选项

在 VS Code 设置中可以配置以下选项：

```json
{
  "sftpExplorer.connections": [],
  "sftpExplorer.autoSync": true,
  "sftpExplorer.showHiddenFiles": false
}
```

### 配置说明

- `connections`: 连接配置列表
- `autoSync`: 是否自动同步远程文件修改
- `showHiddenFiles`: 是否显示隐藏文件

## 🔧 高级用法

### 批量操作

1. 按住 `Ctrl` 或 `Cmd` 多选文件
2. 右键选择批量操作
3. 支持批量删除、复制、剪切

### 拖拽操作

- 拖拽本地文件到远程目录上传
- 拖拽远程文件到本地目录下载
- 拖拽远程文件在远程目录间移动

### 跨连接操作

- 在不同SFTP连接间复制文件
- 支持连接间的文件同步
- 自动处理路径转换

## 🐛 故障排除

### 连接问题

1. **连接超时**

   - 检查网络连接
   - 确认服务器地址和端口
   - 检查防火墙设置

2. **认证失败**

   - 确认用户名和密码
   - 检查私钥文件路径和权限
   - 验证服务器SSH配置

3. **权限错误**
   - 确认用户对目标目录有访问权限
   - 检查文件/目录权限设置

### 性能优化

- 避免在大目录下进行搜索
- 关闭不必要的连接
- 合理设置并发连接数

## 🤝 贡献

欢迎参与项目贡献！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 开发环境设置

```bash
# 克隆仓库
git clone https://github.com/bochili/vscode-sftp-explorer.git
cd vscode-sftp-explorer

# 安装依赖
npm install

# 编译
npm run compile

# 监听模式
npm run watch
```

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

- [ssh2-sftp-client](https://github.com/theophilusx/ssh2-sftp-client) - SFTP客户端核心库
- [node-ssh](https://github.com/steelbrain/node-ssh) - SSH连接处理
- [VS Code Extension API](https://code.visualstudio.com/api) - 扩展开发框架

## 📞 支持

- 🐛 [报告问题](https://github.com/bochili/vscode-sftp-explorer/issues)
- 💡 [功能建议](https://github.com/bochili/vscode-sftp-explorer/issues)
- 📧 邮件支持: bochili@foxmail.com

---

<div align="center">
  <p>如果这个插件对您有帮助，请给个 ⭐ Star!</p>
  <p>Made with ❤️ for the VS Code community</p>
</div>
