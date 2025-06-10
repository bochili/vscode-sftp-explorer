import * as vscode from "vscode";
import { SFTPClientWrapper } from "./sftpClient";
import {
  SFTPConnectionConfig,
  ConnectionState,
  ConnectionStatus,
  LogLevel,
} from "./types";

export class ConnectionManager {
  private connections: Map<string, ConnectionState> = new Map();
  private outputChannel: vscode.OutputChannel;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.outputChannel = vscode.window.createOutputChannel("SFTP Explorer");
    this.loadConnections();
  }

  private log(level: LogLevel, message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${level}: ${message}`);
  }

  loadConnections(): void {
    const config = vscode.workspace.getConfiguration("sftpExplorer");
    const connections: SFTPConnectionConfig[] = config.get("connections", []);

    for (const connectionConfig of connections) {
      this.connections.set(connectionConfig.name, {
        config: connectionConfig,
        status: ConnectionStatus.Disconnected,
        currentPath: connectionConfig.remotePath,
      });
    }

    this.log(LogLevel.Info, `加载了 ${connections.length} 个连接配置`);
  }

  async saveConnections(): Promise<void> {
    const config = vscode.workspace.getConfiguration("sftpExplorer");
    const connections = Array.from(this.connections.values()).map(
      (state) => state.config
    );
    await config.update(
      "connections",
      connections,
      vscode.ConfigurationTarget.Global
    );
    this.log(LogLevel.Info, "连接配置已保存");
  }

  async addConnection(connectionConfig: SFTPConnectionConfig): Promise<void> {
    // 检查连接名称是否已存在
    if (this.connections.has(connectionConfig.name)) {
      throw new Error(`连接名称 "${connectionConfig.name}" 已存在`);
    }

    this.connections.set(connectionConfig.name, {
      config: connectionConfig,
      status: ConnectionStatus.Disconnected,
      currentPath: connectionConfig.remotePath,
    });

    await this.saveConnections();
    this.log(LogLevel.Info, `添加新连接: ${connectionConfig.name}`);
  }

  async updateConnection(
    name: string,
    connectionConfig: SFTPConnectionConfig
  ): Promise<void> {
    const state = this.connections.get(name);
    if (!state) {
      throw new Error(`连接 "${name}" 不存在`);
    }

    // 如果连接已连接，先断开
    if (state.status === ConnectionStatus.Connected && state.client) {
      await state.client.disconnect();
    }

    // 如果名称改变了，需要更新Map的键
    if (name !== connectionConfig.name) {
      this.connections.delete(name);
      this.connections.set(connectionConfig.name, {
        config: connectionConfig,
        status: ConnectionStatus.Disconnected,
        currentPath: connectionConfig.remotePath,
      });
    } else {
      state.config = connectionConfig;
      state.status = ConnectionStatus.Disconnected;
      state.client = undefined;
      state.currentPath = connectionConfig.remotePath;
    }

    await this.saveConnections();
    this.log(LogLevel.Info, `更新连接: ${connectionConfig.name}`);
  }

  async deleteConnection(name: string): Promise<void> {
    const state = this.connections.get(name);
    if (!state) {
      throw new Error(`连接 "${name}" 不存在`);
    }

    // 如果连接已连接，先断开
    if (state.status === ConnectionStatus.Connected && state.client) {
      await state.client.disconnect();
    }

    this.connections.delete(name);
    await this.saveConnections();
    this.log(LogLevel.Info, `删除连接: ${name}`);
  }

  async connect(name: string, cancellationToken?: any): Promise<boolean> {
    const state = this.connections.get(name);
    if (!state) {
      this.log(LogLevel.Error, `连接 "${name}" 不存在`);
      return false;
    }

    if (state.status === ConnectionStatus.Connected) {
      this.log(LogLevel.Warning, `连接 "${name}" 已经连接`);
      return true;
    }

    try {
      state.status = ConnectionStatus.Connecting;
      this.log(LogLevel.Info, `正在連接到 ${name}...`);

      const client = new SFTPClientWrapper();

      // 检查是否在连接前就被取消了
      if (cancellationToken?.isCancellationRequested) {
        state.status = ConnectionStatus.Disconnected;
        state.lastError = undefined;
        this.log(LogLevel.Info, `连接 ${name} 被取消`);
        return false;
      }

      const result = await client.connect(state.config);

      // 再次检查是否被取消了
      if (cancellationToken?.isCancellationRequested) {
        // 如果连接成功但被取消了，断开连接
        if (result.success) {
          await client.disconnect();
        }
        state.status = ConnectionStatus.Disconnected;
        state.lastError = undefined;
        this.log(LogLevel.Info, `连接 ${name} 被取消`);
        return false;
      }

      if (result.success) {
        state.client = client;
        state.status = ConnectionStatus.Connected;
        state.lastError = undefined;
        this.log(LogLevel.Info, `成功连接到 ${name}: ${result.message}`);
        return true;
      } else {
        state.status = ConnectionStatus.Disconnected;
        state.lastError = result.message;
        this.log(LogLevel.Error, `连接 ${name} 失败: ${result.message}`);
        return false;
      }
    } catch (error) {
      // 确保连接失败时重置为断开状态
      state.status = ConnectionStatus.Disconnected;
      state.lastError = error instanceof Error ? error.message : String(error);
      this.log(LogLevel.Error, `连接 ${name} 时发生异常: ${state.lastError}`);
      return false;
    }
  }

  // 添加取消连接的方法
  cancelConnection(name: string): void {
    const state = this.connections.get(name);
    if (state && state.status === ConnectionStatus.Connecting) {
      state.status = ConnectionStatus.Disconnected;
      state.lastError = undefined;
      this.log(LogLevel.Info, `已取消连接 ${name}`);
    }
  }

  async disconnect(name: string): Promise<void> {
    const state = this.connections.get(name);
    if (!state) {
      this.log(LogLevel.Error, `连接 "${name}" 不存在`);
      return;
    }

    if (state.status !== ConnectionStatus.Connected || !state.client) {
      this.log(LogLevel.Warning, `连接 "${name}" 未连接`);
      return;
    }

    try {
      await state.client.disconnect();
      state.status = ConnectionStatus.Disconnected;
      state.client = undefined;
      state.lastError = undefined;
      this.log(LogLevel.Info, `已断开连接: ${name}`);
    } catch (error) {
      this.log(
        LogLevel.Error,
        `断开连接 ${name} 时发生错误: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.connections.keys()).map((name) =>
      this.disconnect(name)
    );
    await Promise.all(promises);
    this.log(LogLevel.Info, "已断开所有连接");
  }

  getConnection(name: string): ConnectionState | undefined {
    return this.connections.get(name);
  }

  getAllConnections(): ConnectionState[] {
    return Array.from(this.connections.values());
  }

  getConnectedClients(): Map<string, SFTPClientWrapper> {
    const clients = new Map<string, SFTPClientWrapper>();

    for (const [name, state] of this.connections) {
      if (state.status === ConnectionStatus.Connected && state.client) {
        clients.set(name, state.client as SFTPClientWrapper);
      }
    }

    return clients;
  }

  isConnected(name: string): boolean {
    const state = this.connections.get(name);
    return state?.status === ConnectionStatus.Connected && !!state.client;
  }

  getCurrentPath(name: string): string {
    const state = this.connections.get(name);
    return state?.currentPath || "/";
  }

  setCurrentPath(name: string, path: string): void {
    const state = this.connections.get(name);
    if (state) {
      state.currentPath = path;
    }
  }

  showOutput(): void {
    this.outputChannel.show();
  }

  dispose(): void {
    this.disconnectAll();
    this.outputChannel.dispose();
  }
}
