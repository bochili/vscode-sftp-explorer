import * as vscode from "vscode";
import * as path from "path";
import { ConnectionManager } from "./connectionManager";
import {
  ConnectionState,
  ConnectionStatus,
  FileItem,
  TreeItemType,
} from "./types";

export class TreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly itemType: TreeItemType,
    public readonly connectionName?: string,
    public readonly remotePath?: string,
    public readonly fileItem?: FileItem
  ) {
    super(label, collapsibleState);

    this.contextValue = itemType;
    this.tooltip = this.getTooltip();
    this.iconPath = this.getIcon();

    // 设置命令 - 双击文件时打开
    if (itemType === "file" && fileItem) {
      this.command = {
        command: "sftpExplorer.openFile",
        title: "打开文件",
        arguments: [fileItem],
      };
    }
  }

  private getTooltip(): string {
    switch (this.itemType) {
      case "connection-disconnected":
        return `${this.connectionName} (未连接)`;
      case "connection-connected":
        return `${this.connectionName} (已连接)`;
      case "connection-connecting":
        return `${this.connectionName} (连接中...)`;
      case "connection-error":
        return `${this.connectionName} (连接错误)`;
      case "folder":
        return `文件夹: ${this.remotePath}`;
      case "file":
        if (this.fileItem) {
          const size = this.formatFileSize(this.fileItem.size);
          const date = this.fileItem.modifyTime.toLocaleDateString();
          return `文件: ${this.remotePath}\n大小: ${size}\n修改时间: ${date}`;
        }
        return `文件: ${this.remotePath}`;
      default:
        return this.label;
    }
  }

  private getIcon(): vscode.ThemeIcon | undefined {
    switch (this.itemType) {
      case "connection-disconnected":
        return new vscode.ThemeIcon("debug-disconnect");
      case "connection-connected":
        return new vscode.ThemeIcon("vm-connect");
      case "connection-connecting":
        return new vscode.ThemeIcon("loading~spin");
      case "connection-error":
        return new vscode.ThemeIcon("error");
      case "folder":
        return this.getFolderIcon();
      case "file":
        return this.getFileIcon();
      default:
        return undefined;
    }
  }

  private getFolderIcon(): vscode.ThemeIcon {
    // 检查是否是特殊文件夹
    if (this.fileItem?.name) {
      const folderName = this.fileItem.name.toLowerCase();

      // 常见的特殊文件夹图标映射
      const specialFolders: { [key: string]: string } = {
        ".git": "source-control",
        ".vscode": "settings-gear",
        ".github": "github",
        node_modules: "library",
        src: "folder-library",
        dist: "folder-opened",
        build: "tools",
        public: "globe",
        assets: "file-media",
        images: "file-media",
        img: "file-media",
        css: "symbol-color",
        js: "symbol-method",
        javascript: "symbol-method",
        typescript: "symbol-method",
        ts: "symbol-method",
        components: "symbol-class",
        utils: "symbol-namespace",
        lib: "library",
        libs: "library",
        test: "beaker",
        tests: "beaker",
        __tests__: "beaker",
        spec: "beaker",
        docs: "book",
        documentation: "book",
        config: "settings-gear",
        configs: "settings-gear",
        scripts: "terminal",
        bin: "terminal",
        logs: "output",
        tmp: "file-submodule",
        temp: "file-submodule",
        cache: "database",
        vendor: "package",
        modules: "package",
      };

      if (specialFolders[folderName]) {
        return new vscode.ThemeIcon(specialFolders[folderName]);
      }
    }

    return vscode.ThemeIcon.Folder;
  }

  private getFileIcon(): vscode.ThemeIcon {
    if (!this.fileItem?.name) {
      return vscode.ThemeIcon.File;
    }

    const fileName = this.fileItem.name.toLowerCase();
    const extension = this.getFileExtension(fileName);

    // 特殊文件名映射
    const specialFiles: { [key: string]: string } = {
      "readme.md": "book",
      "readme.txt": "book",
      readme: "book",
      "changelog.md": "history",
      changelog: "history",
      license: "law",
      "license.txt": "law",
      "license.md": "law",
      "mit-license": "law",
      "package.json": "json",
      "package-lock.json": "json",
      "yarn.lock": "json",
      "composer.json": "json",
      "bower.json": "json",
      "tsconfig.json": "settings-gear",
      "jsconfig.json": "settings-gear",
      "webpack.config.js": "settings-gear",
      "vite.config.js": "settings-gear",
      "rollup.config.js": "settings-gear",
      "babel.config.js": "settings-gear",
      "eslint.config.js": "settings-gear",
      ".eslintrc": "settings-gear",
      ".eslintrc.js": "settings-gear",
      ".eslintrc.json": "settings-gear",
      ".prettierrc": "settings-gear",
      ".prettierrc.json": "settings-gear",
      "prettier.config.js": "settings-gear",
      ".gitignore": "source-control",
      ".gitattributes": "source-control",
      ".dockerignore": "file-submodule",
      dockerfile: "file-binary",
      "docker-compose.yml": "file-binary",
      "docker-compose.yaml": "file-binary",
      makefile: "tools",
      rakefile: "tools",
      "gruntfile.js": "tools",
      "gulpfile.js": "tools",
    };

    if (specialFiles[fileName]) {
      return new vscode.ThemeIcon(specialFiles[fileName]);
    }

    // 根据文件扩展名映射图标
    const extensionIcons: { [key: string]: string } = {
      // 编程语言
      js: "symbol-method",
      jsx: "symbol-method",
      ts: "symbol-method",
      tsx: "symbol-method",
      py: "symbol-method",
      java: "symbol-class",
      class: "symbol-class",
      c: "symbol-method",
      cpp: "symbol-method",
      cc: "symbol-method",
      cxx: "symbol-method",
      "c++": "symbol-method",
      h: "symbol-method",
      hpp: "symbol-method",
      cs: "symbol-class",
      php: "symbol-method",
      rb: "symbol-method",
      go: "symbol-method",
      rs: "symbol-method",
      swift: "symbol-method",
      kt: "symbol-method",
      scala: "symbol-method",
      clj: "symbol-method",
      r: "symbol-method",
      sh: "terminal",
      bash: "terminal",
      zsh: "terminal",
      fish: "terminal",
      ps1: "terminal",
      bat: "terminal",
      cmd: "terminal",

      // 标记语言
      html: "symbol-color",
      htm: "symbol-color",
      xml: "symbol-color",
      xhtml: "symbol-color",
      md: "markdown",
      markdown: "markdown",
      rst: "markdown",
      tex: "markdown",
      asciidoc: "markdown",

      // 样式文件
      css: "symbol-color",
      scss: "symbol-color",
      sass: "symbol-color",
      less: "symbol-color",
      styl: "symbol-color",

      // 配置文件
      json: "json",
      yml: "gear",
      yaml: "gear",
      toml: "gear",
      ini: "gear",
      cfg: "gear",
      conf: "gear",
      config: "gear",
      properties: "gear",

      // 数据文件
      sql: "database",
      db: "database",
      sqlite: "database",
      csv: "graph",
      tsv: "graph",
      xlsx: "graph",
      xls: "graph",

      // 文档文件
      txt: "file-text",
      rtf: "file-text",
      doc: "file-text",
      docx: "file-text",
      pdf: "file-pdf",

      // 图片文件
      png: "file-media",
      jpg: "file-media",
      jpeg: "file-media",
      gif: "file-media",
      svg: "file-media",
      bmp: "file-media",
      ico: "file-media",
      webp: "file-media",
      tiff: "file-media",
      tif: "file-media",

      // 音频文件
      mp3: "file-media",
      wav: "file-media",
      flac: "file-media",
      aac: "file-media",
      ogg: "file-media",
      m4a: "file-media",

      // 视频文件
      mp4: "file-media",
      avi: "file-media",
      mov: "file-media",
      mkv: "file-media",
      wmv: "file-media",
      flv: "file-media",
      webm: "file-media",

      // 压缩文件
      zip: "file-zip",
      rar: "file-zip",
      "7z": "file-zip",
      tar: "file-zip",
      gz: "file-zip",
      bz2: "file-zip",
      xz: "file-zip",

      // 字体文件
      ttf: "symbol-color",
      otf: "symbol-color",
      woff: "symbol-color",
      woff2: "symbol-color",
      eot: "symbol-color",

      // 其他
      log: "output",
      tmp: "file-submodule",
      temp: "file-submodule",
      cache: "database",
      lock: "lock",
      env: "gear",
      example: "lightbulb",
      sample: "lightbulb",
    };

    if (extension && extensionIcons[extension]) {
      return new vscode.ThemeIcon(extensionIcons[extension]);
    }

    // 检查是否是可执行文件
    if (this.fileItem.permissions && this.fileItem.permissions.includes("x")) {
      return new vscode.ThemeIcon("terminal");
    }

    // 默认文件图标
    return vscode.ThemeIcon.File;
  }

  private getFileExtension(fileName: string): string | null {
    const dotIndex = fileName.lastIndexOf(".");
    if (dotIndex === -1 || dotIndex === 0 || dotIndex === fileName.length - 1) {
      return null;
    }
    return fileName.substring(dotIndex + 1).toLowerCase();
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
}

export class SFTPTreeDataProvider
  implements
    vscode.TreeDataProvider<TreeItem>,
    vscode.TreeDragAndDropController<TreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    TreeItem | undefined | null | void
  > = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    TreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  // 拖拽支持
  readonly dropMimeTypes = [
    "application/vnd.code.tree.sftpExplorer",
    "text/uri-list", // 支持从外部拖拽文件
    "Files", // 支持Windows文件拖拽
  ];
  readonly dragMimeTypes = ["application/vnd.code.tree.sftpExplorer"];

  private fileCache: Map<string, FileItem[]> = new Map();
  private loadingCache: Map<string, Promise<FileItem[]>> = new Map(); // 防止重复请求

  constructor(private connectionManager: ConnectionManager) {
    // 监听配置变化
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("sftpExplorer")) {
        this.refresh();
      }
    });
  }

  refresh(): void {
    this.fileCache.clear();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!element) {
      // 根级别 - 显示所有连接
      return this.getConnectionItems();
    }

    if (element.itemType.startsWith("connection") && element.connectionName) {
      // 连接级别 - 显示远程根目录
      return this.getRemoteFiles(
        element.connectionName,
        element.remotePath || "/"
      );
    }

    if (
      element.itemType === "folder" &&
      element.connectionName &&
      element.remotePath
    ) {
      // 文件夹级别 - 显示文件夹内容
      return this.getRemoteFiles(element.connectionName, element.remotePath);
    }

    return [];
  }

  private getConnectionItems(): TreeItem[] {
    const connections = this.connectionManager.getAllConnections();

    return connections.map((state) => {
      const itemType = this.getConnectionItemType(state);
      const collapsibleState =
        state.status === ConnectionStatus.Connected
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None;

      return new TreeItem(
        state.config.name,
        collapsibleState,
        itemType,
        state.config.name,
        state.currentPath
      );
    });
  }

  private getConnectionItemType(state: ConnectionState): TreeItemType {
    switch (state.status) {
      case ConnectionStatus.Connected:
        return "connection-connected";
      case ConnectionStatus.Connecting:
        return "connection-connecting";
      case ConnectionStatus.Error:
        return "connection-error";
      default:
        return "connection-disconnected";
    }
  }

  private async getRemoteFiles(
    connectionName: string,
    remotePath: string
  ): Promise<TreeItem[]> {
    const cacheKey = `${connectionName}:${remotePath}`;

    // 检查缓存
    if (this.fileCache.has(cacheKey)) {
      const cachedFiles = this.fileCache.get(cacheKey)!;
      return this.convertFilesToTreeItems(cachedFiles, connectionName);
    }

    // 检查是否正在加载，避免重复请求
    if (this.loadingCache.has(cacheKey)) {
      const files = await this.loadingCache.get(cacheKey)!;
      return this.convertFilesToTreeItems(files, connectionName);
    }

    // 检查连接状态
    if (!this.connectionManager.isConnected(connectionName)) {
      return [];
    }

    const state = this.connectionManager.getConnection(connectionName);
    if (!state?.client) {
      return [];
    }

    // 创建加载Promise并缓存，防止重复请求
    const loadingPromise = this.loadRemoteFiles(
      state.client,
      remotePath,
      cacheKey
    );
    this.loadingCache.set(cacheKey, loadingPromise);

    try {
      const files = await loadingPromise;

      // 使用异步转换避免阻塞
      return await Promise.resolve(
        this.convertFilesToTreeItems(files, connectionName)
      );
    } catch (error) {
      // 不要在每次失败时都显示错误消息，这会影响性能
      console.error(
        `获取远程文件列表失败 (${connectionName}:${remotePath}):`,
        error
      );

      // 只在第一次失败时显示错误
      const errorKey = `error_${cacheKey}`;
      if (!this.fileCache.has(errorKey)) {
        this.fileCache.set(errorKey, []);
        vscode.window.showErrorMessage(
          `获取远程文件列表失败: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        // 5秒后清除错误标记，允许重新显示错误
        setTimeout(() => {
          this.fileCache.delete(errorKey);
        }, 5000);
      }

      return [];
    }
  }

  private async loadRemoteFiles(
    client: any,
    remotePath: string,
    cacheKey: string
  ): Promise<FileItem[]> {
    try {
      // 使用Promise来优化性能，避免阻塞UI
      const files = await Promise.resolve(client.list(remotePath));

      // 获取配置，避免重复调用
      const config = vscode.workspace.getConfiguration("sftpExplorer");
      const showHidden = config.get<boolean>("showHiddenFiles", false);

      // 使用更高效的过滤和排序
      let processedFiles: FileItem[];

      if (showHidden) {
        processedFiles = files;
      } else {
        // 使用更高效的过滤方法
        processedFiles = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (!file.name.startsWith(".")) {
            processedFiles.push(file);
          }
        }
      }

      // 优化排序算法 - 先分离目录和文件，然后分别排序
      const directories: FileItem[] = [];
      const regularFiles: FileItem[] = [];

      for (let i = 0; i < processedFiles.length; i++) {
        const file = processedFiles[i];
        if (file.type === "directory") {
          directories.push(file);
        } else {
          regularFiles.push(file);
        }
      }

      // 分别排序目录和文件（减少比较次数）
      directories.sort((a, b) => a.name.localeCompare(b.name));
      regularFiles.sort((a, b) => a.name.localeCompare(b.name));

      // 合并结果：目录在前
      const sortedFiles = [...directories, ...regularFiles];

      // 立即缓存结果
      this.fileCache.set(cacheKey, sortedFiles);

      return sortedFiles;
    } finally {
      // 清除加载缓存
      this.loadingCache.delete(cacheKey);
    }
  }

  private convertFilesToTreeItems(
    files: FileItem[],
    connectionName: string
  ): TreeItem[] {
    // 预分配数组大小以提高性能
    const result = new Array<TreeItem>(files.length);

    // 避免重复的条件判断
    const collapsedState = vscode.TreeItemCollapsibleState.Collapsed;
    const noneState = vscode.TreeItemCollapsibleState.None;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isDirectory = file.type === "directory";

      result[i] = new TreeItem(
        file.name,
        isDirectory ? collapsedState : noneState,
        isDirectory ? "folder" : "file",
        connectionName,
        file.path,
        file
      );
    }

    return result;
  }

  // 清除特定路径的缓存
  clearCache(connectionName: string, remotePath?: string): void {
    if (remotePath) {
      const cacheKey = `${connectionName}:${remotePath}`;
      this.fileCache.delete(cacheKey);
      this.loadingCache.delete(cacheKey);
    } else {
      // 清除该连接的所有缓存
      for (const key of this.fileCache.keys()) {
        if (key.startsWith(`${connectionName}:`)) {
          this.fileCache.delete(key);
        }
      }
      for (const key of this.loadingCache.keys()) {
        if (key.startsWith(`${connectionName}:`)) {
          this.loadingCache.delete(key);
        }
      }
    }
  }

  // 刷新特定连接
  refreshConnection(connectionName: string): void {
    this.clearCache(connectionName);
    this._onDidChangeTreeData.fire();
  }

  // 刷新特定路径
  refreshPath(connectionName: string, remotePath: string): void {
    this.clearCache(connectionName, remotePath);
    this._onDidChangeTreeData.fire();
  }

  // 拖拽开始
  async handleDrag(
    source: TreeItem[],
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<void> {
    const dragData = source.map((item) => ({
      connectionName: item.connectionName,
      remotePath: item.remotePath,
      fileItem: item.fileItem,
      itemType: item.itemType,
    }));

    dataTransfer.set(
      "application/vnd.code.tree.sftpExplorer",
      new vscode.DataTransferItem(JSON.stringify(dragData))
    );
  }

  // 拖拽放置
  async handleDrop(
    target: TreeItem | undefined,
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<void> {
    if (
      !target ||
      (target.itemType !== "folder" && !target.itemType.includes("connection"))
    ) {
      return;
    }

    // 确定目标路径
    let targetPath = target.remotePath;
    if (!targetPath && target.itemType.includes("connection")) {
      // 如果是连接节点，使用连接的根路径
      targetPath = "/";
    }

    try {
      // 处理内部拖拽
      const internalTransfer = dataTransfer.get(
        "application/vnd.code.tree.sftpExplorer"
      );
      if (internalTransfer) {
        const dragData = JSON.parse(internalTransfer.value as string);
        await this.performDropOperation(dragData, target);

        // 刷新相关视图
        if (target.connectionName && targetPath) {
          this.refreshPath(target.connectionName, targetPath);
        }

        // 如果源和目标不同，也刷新源位置
        for (const item of dragData) {
          if (
            item.connectionName !== target.connectionName &&
            item.remotePath
          ) {
            const parentPath = path.posix.dirname(item.remotePath);
            this.refreshPath(item.connectionName, parentPath);
          }
        }
        return;
      }

      // 处理外部文件拖拽
      const uriListTransfer = dataTransfer.get("text/uri-list");
      const filesTransfer = dataTransfer.get("Files");

      if (uriListTransfer || filesTransfer) {
        await this.handleExternalFileDrop(target, dataTransfer);

        // 刷新目标视图
        if (target.connectionName && targetPath) {
          this.refreshPath(target.connectionName, targetPath);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `拖拽操作失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async performDropOperation(
    dragData: any[],
    target: TreeItem
  ): Promise<void> {
    // 这里需要调用外部的拖拽处理逻辑
    // 由于需要访问connectionManager，我们将在extension.ts中处理
    const command = "sftpExplorer.handleDrop";
    await vscode.commands.executeCommand(command, dragData, target);
  }

  // 处理外部文件拖拽
  private async handleExternalFileDrop(
    target: TreeItem,
    dataTransfer: vscode.DataTransfer
  ): Promise<void> {
    const uriListTransfer = dataTransfer.get("text/uri-list");
    let fileUris: vscode.Uri[] = [];

    if (uriListTransfer) {
      // 解析URI列表
      const uriList = uriListTransfer.value as string;
      const uris = uriList.split("\n").filter((uri) => uri.trim().length > 0);

      for (const uriString of uris) {
        try {
          const uri = vscode.Uri.parse(uriString.trim());
          if (uri.scheme === "file") {
            fileUris.push(uri);
          }
        } catch (error) {
          console.warn("Failed to parse URI:", uriString, error);
        }
      }
    }

    if (fileUris.length > 0) {
      // 调用外部命令处理文件上传
      const command = "sftpExplorer.handleExternalDrop";
      await vscode.commands.executeCommand(command, fileUris, target);
    }
  }
}
