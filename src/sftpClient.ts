import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import Client from "ssh2-sftp-client";
import {
  SFTPClient,
  SFTPConnectionConfig,
  SFTPOperationResult,
  FileItem,
  ProgressCallback,
} from "./types";

export class SFTPClientWrapper implements SFTPClient {
  private client: Client;
  private config?: SFTPConnectionConfig;
  private isConnected: boolean = false;

  constructor() {
    this.client = new Client();
  }

  async connect(config: SFTPConnectionConfig): Promise<SFTPOperationResult> {
    try {
      this.config = config;

      const connectConfig: any = {
        host: config.host,
        port: config.port,
        username: config.username,
      };

      // 根据认证方式配置连接
      if (config.privateKeyPath) {
        // 使用私钥认证
        if (fs.existsSync(config.privateKeyPath)) {
          connectConfig.privateKey = fs.readFileSync(config.privateKeyPath);
        } else {
          throw new Error(`私钥文件不存在: ${config.privateKeyPath}`);
        }
      } else if (config.password) {
        // 使用密码认证
        connectConfig.password = config.password;
      } else {
        throw new Error("必须提供密码或私钥进行认证");
      }

      await this.client.connect(connectConfig);
      this.isConnected = true;

      return {
        success: true,
        message: `成功连接到 ${config.host}:${config.port}`,
      };
    } catch (error) {
      this.isConnected = false;
      return {
        success: false,
        message: `连接失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.client.end();
        this.isConnected = false;
      }
    } catch (error) {
      console.error("断开连接时发生错误:", error);
    }
  }

  async list(remotePath: string): Promise<FileItem[]> {
    if (!this.isConnected || !this.config) {
      throw new Error("未连接到服务器");
    }

    try {
      const files = await this.client.list(remotePath);
      return files.map((file: any) => ({
        name: file.name,
        path: path.posix.join(remotePath, file.name),
        type: file.type === "d" ? "directory" : "file",
        size: file.size,
        modifyTime: new Date(file.modifyTime),
        permissions: file.rights?.toString() || "",
        isSymlink: file.type === "l",
        connectionId: this.config!.name,
      }));
    } catch (error) {
      throw new Error(
        `列出目录失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async exists(remotePath: string): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.client.stat(remotePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  async get(
    remotePath: string,
    localPath: string,
    callback?: ProgressCallback
  ): Promise<SFTPOperationResult> {
    if (!this.isConnected) {
      return {
        success: false,
        message: "未连接到服务器",
      };
    }

    try {
      // 确保本地目录存在
      const localDir = path.dirname(localPath);
      if (!fs.existsSync(localDir)) {
        await fs.promises.mkdir(localDir, { recursive: true });
      }

      let totalSize = 0;
      let transferredSize = 0;

      // 获取文件大小用于进度计算
      try {
        const stat = await this.client.stat(remotePath);
        totalSize = stat.size;
      } catch (error) {
        // 如果无法获取文件大小，继续下载
      }

      await this.client.get(remotePath, localPath);

      return {
        success: true,
        message: `文件下载成功: ${path.basename(remotePath)}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `下载文件失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async put(
    localPath: string,
    remotePath: string,
    callback?: ProgressCallback
  ): Promise<SFTPOperationResult> {
    if (!this.isConnected) {
      return {
        success: false,
        message: "未连接到服务器",
      };
    }

    try {
      // 检查本地文件是否存在
      if (!fs.existsSync(localPath)) {
        return {
          success: false,
          message: `本地文件不存在: ${localPath}`,
        };
      }

      let totalSize = 0;
      let transferredSize = 0;

      // 获取本地文件大小
      try {
        const stat = await fs.promises.stat(localPath);
        totalSize = stat.size;
      } catch (error) {
        // 如果无法获取文件大小，继续上传
      }

      await this.client.put(localPath, remotePath);

      return {
        success: true,
        message: `文件上传成功: ${path.basename(localPath)}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `上传文件失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async delete(remotePath: string): Promise<SFTPOperationResult> {
    if (!this.isConnected) {
      return {
        success: false,
        message: "未连接到服务器",
      };
    }

    try {
      // 检查是文件还是目录
      const stat = await this.client.stat(remotePath);

      if (stat.isDirectory) {
        await this.client.rmdir(remotePath, true); // 递归删除目录
      } else {
        await this.client.delete(remotePath);
      }

      return {
        success: true,
        message: `删除成功: ${path.basename(remotePath)}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `删除失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async mkdir(remotePath: string): Promise<SFTPOperationResult> {
    if (!this.isConnected) {
      return {
        success: false,
        message: "未连接到服务器",
      };
    }

    try {
      await this.client.mkdir(remotePath, true); // 递归创建目录
      return {
        success: true,
        message: `目录创建成功: ${path.basename(remotePath)}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `创建目录失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async rmdir(remotePath: string): Promise<SFTPOperationResult> {
    if (!this.isConnected) {
      return {
        success: false,
        message: "未连接到服务器",
      };
    }

    try {
      await this.client.rmdir(remotePath, true); // 递归删除目录
      return {
        success: true,
        message: `目录删除成功: ${path.basename(remotePath)}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `删除目录失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async rename(oldPath: string, newPath: string): Promise<SFTPOperationResult> {
    if (!this.isConnected) {
      return {
        success: false,
        message: "未连接到服务器",
      };
    }

    try {
      await this.client.rename(oldPath, newPath);
      return {
        success: true,
        message: `重命名成功: ${path.basename(oldPath)} -> ${path.basename(
          newPath
        )}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `重命名失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async chmod(remotePath: string, mode: string): Promise<SFTPOperationResult> {
    if (!this.isConnected) {
      return {
        success: false,
        message: "未连接到服务器",
      };
    }

    try {
      await this.client.chmod(remotePath, mode);
      return {
        success: true,
        message: `权限修改成功: ${path.basename(remotePath)} (${mode})`,
      };
    } catch (error) {
      return {
        success: false,
        message: `修改权限失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async stat(remotePath: string): Promise<FileItem | null> {
    if (!this.isConnected || !this.config) {
      return null;
    }

    try {
      const stat = await this.client.stat(remotePath);
      return {
        name: path.basename(remotePath),
        path: remotePath,
        type: stat.isDirectory ? "directory" : "file",
        size: stat.size,
        modifyTime: new Date(stat.modifyTime),
        permissions: stat.mode?.toString() || "",
        connectionId: this.config.name,
      };
    } catch (error) {
      return null;
    }
  }

  get connected(): boolean {
    return this.isConnected;
  }

  get connectionConfig(): SFTPConnectionConfig | undefined {
    return this.config;
  }
}
