import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ClipboardItem, ClipboardOperationType, FileItem } from "./types";
import { ConnectionManager } from "./connectionManager";

export class ClipboardManager {
  private clipboardData: ClipboardItem | null = null;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  // 复制操作
  async copy(items: FileItem[], sourceConnectionId: string): Promise<void> {
    this.clipboardData = {
      operation: "copy",
      items: items,
      sourceConnectionId: sourceConnectionId,
      timestamp: new Date(),
    };

    const fileNames = items.map((item) => item.name).join(", ");
    vscode.window.showInformationMessage(`已复制: ${fileNames}`);
  }

  // 剪切操作
  async cut(items: FileItem[], sourceConnectionId: string): Promise<void> {
    this.clipboardData = {
      operation: "cut",
      items: items,
      sourceConnectionId: sourceConnectionId,
      timestamp: new Date(),
    };

    const fileNames = items.map((item) => item.name).join(", ");
    vscode.window.showInformationMessage(`已剪切: ${fileNames}`);
  }

  // 粘贴操作
  async paste(
    targetConnectionId: string,
    targetPath: string,
    connectionManager: ConnectionManager
  ): Promise<boolean> {
    if (!this.clipboardData) {
      vscode.window.showWarningMessage("剪贴板为空");
      return false;
    }

    try {
      const result = await this.performPasteOperation(
        this.clipboardData,
        targetConnectionId,
        targetPath,
        connectionManager
      );

      if (result) {
        const fileNames = this.clipboardData.items
          .map((item) => item.name)
          .join(", ");
        vscode.window.showInformationMessage(
          `粘贴完成: ${fileNames} 到 ${targetPath}`
        );

        // 如果是剪切操作，清空剪贴板
        if (this.clipboardData.operation === "cut") {
          this.clipboardData = null;
        }
      }

      return result;
    } catch (error) {
      vscode.window.showErrorMessage(
        `粘贴失败: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }

  // 执行粘贴操作
  private async performPasteOperation(
    clipboardData: ClipboardItem,
    targetConnectionId: string,
    targetPath: string,
    connectionManager: ConnectionManager
  ): Promise<boolean> {
    const isLocalToRemote = clipboardData.sourceConnectionId === "__LOCAL__";
    const isRemoteToLocal = targetConnectionId === "__LOCAL__";
    const isRemoteToRemote = !isLocalToRemote && !isRemoteToLocal;

    if (isLocalToRemote) {
      return await this.pasteLocalToRemote(
        clipboardData,
        targetConnectionId,
        targetPath,
        connectionManager
      );
    } else if (isRemoteToLocal) {
      return await this.pasteRemoteToLocal(
        clipboardData,
        targetPath,
        connectionManager
      );
    } else if (isRemoteToRemote) {
      return await this.pasteRemoteToRemote(
        clipboardData,
        targetConnectionId,
        targetPath,
        connectionManager
      );
    }

    return false;
  }

  // 本地到远程粘贴
  private async pasteLocalToRemote(
    clipboardData: ClipboardItem,
    targetConnectionId: string,
    targetPath: string,
    connectionManager: ConnectionManager
  ): Promise<boolean> {
    const targetState = connectionManager.getConnection(targetConnectionId);
    if (!targetState?.client) {
      throw new Error("目标连接未建立");
    }

    for (const item of clipboardData.items) {
      const sourcePath = item.path;
      const targetFilePath = path.posix.join(targetPath, item.name);

      if (item.type === "file") {
        const result = await targetState.client.put(sourcePath, targetFilePath);
        if (!result.success) {
          throw new Error(`上传文件失败: ${result.message}`);
        }

        // 如果是剪切操作，删除源文件
        if (clipboardData.operation === "cut") {
          try {
            await fs.promises.unlink(sourcePath);
          } catch (error) {
            console.warn(`删除源文件失败: ${sourcePath}`, error);
          }
        }
      } else {
        // 目录处理
        await this.uploadDirectory(
          sourcePath,
          targetFilePath,
          targetState.client,
          clipboardData.operation === "cut"
        );
      }
    }

    return true;
  }

  // 远程到本地粘贴
  private async pasteRemoteToLocal(
    clipboardData: ClipboardItem,
    targetPath: string,
    connectionManager: ConnectionManager
  ): Promise<boolean> {
    const sourceState = connectionManager.getConnection(
      clipboardData.sourceConnectionId
    );
    if (!sourceState?.client) {
      throw new Error("源连接未建立");
    }

    for (const item of clipboardData.items) {
      const sourcePath = item.path;
      const targetFilePath = path.join(targetPath, item.name);

      if (item.type === "file") {
        const result = await sourceState.client.get(sourcePath, targetFilePath);
        if (!result.success) {
          throw new Error(`下载文件失败: ${result.message}`);
        }

        // 如果是剪切操作，删除源文件
        if (clipboardData.operation === "cut") {
          await sourceState.client.delete(sourcePath);
        }
      } else {
        // 目录处理
        await this.downloadDirectory(
          sourcePath,
          targetFilePath,
          sourceState.client,
          clipboardData.operation === "cut"
        );
      }
    }

    return true;
  }

  // 远程到远程粘贴
  private async pasteRemoteToRemote(
    clipboardData: ClipboardItem,
    targetConnectionId: string,
    targetPath: string,
    connectionManager: ConnectionManager
  ): Promise<boolean> {
    const sourceState = connectionManager.getConnection(
      clipboardData.sourceConnectionId
    );
    const targetState = connectionManager.getConnection(targetConnectionId);

    if (!sourceState?.client || !targetState?.client) {
      throw new Error("源连接或目标连接未建立");
    }

    // 如果是同一个连接，直接在服务器上操作
    if (clipboardData.sourceConnectionId === targetConnectionId) {
      return await this.pasteSameRemote(
        clipboardData,
        targetPath,
        sourceState.client
      );
    }

    // 不同连接，需要下载到临时目录再上传
    const tempDir = path.join(
      require("os").tmpdir(),
      "sftp-explorer-temp",
      Date.now().toString()
    );

    try {
      await fs.promises.mkdir(tempDir, { recursive: true });

      // 先下载到临时目录
      for (const item of clipboardData.items) {
        const tempPath = path.join(tempDir, item.name);
        if (item.type === "file") {
          const result = await sourceState.client.get(item.path, tempPath);
          if (!result.success) {
            throw new Error(`下载临时文件失败: ${result.message}`);
          }
        } else {
          await this.downloadDirectory(
            item.path,
            tempPath,
            sourceState.client,
            false
          );
        }
      }

      // 再上传到目标
      for (const item of clipboardData.items) {
        const tempPath = path.join(tempDir, item.name);
        const targetFilePath = path.posix.join(targetPath, item.name);

        if (item.type === "file") {
          const result = await targetState.client.put(tempPath, targetFilePath);
          if (!result.success) {
            throw new Error(`上传文件失败: ${result.message}`);
          }
        } else {
          await this.uploadDirectory(
            tempPath,
            targetFilePath,
            targetState.client,
            false
          );
        }

        // 如果是剪切操作，删除源文件
        if (clipboardData.operation === "cut") {
          await sourceState.client.delete(item.path);
        }
      }

      return true;
    } finally {
      // 清理临时目录
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn("清理临时目录失败:", error);
      }
    }
  }

  // 同一远程服务器内粘贴
  private async pasteSameRemote(
    clipboardData: ClipboardItem,
    targetPath: string,
    client: any
  ): Promise<boolean> {
    for (const item of clipboardData.items) {
      const sourcePath = item.path;
      const targetFilePath = path.posix.join(targetPath, item.name);

      if (clipboardData.operation === "cut") {
        // 剪切 = 移动
        const result = await client.rename(sourcePath, targetFilePath);
        if (!result.success) {
          throw new Error(`移动失败: ${result.message}`);
        }
      } else {
        // 复制需要特殊处理，SFTP没有直接的复制命令
        // 对于文件，我们需要先下载再上传
        if (item.type === "file") {
          const tempFile = path.join(
            require("os").tmpdir(),
            `sftp-temp-${Date.now()}-${item.name}`
          );

          try {
            const downloadResult = await client.get(sourcePath, tempFile);
            if (!downloadResult.success) {
              throw new Error(`临时下载失败: ${downloadResult.message}`);
            }

            const uploadResult = await client.put(tempFile, targetFilePath);
            if (!uploadResult.success) {
              throw new Error(`复制上传失败: ${uploadResult.message}`);
            }
          } finally {
            try {
              await fs.promises.unlink(tempFile);
            } catch (error) {
              console.warn("清理临时文件失败:", error);
            }
          }
        } else {
          // 目录复制比较复杂，这里简化处理
          throw new Error("同服务器目录复制暂不支持，请使用剪切操作");
        }
      }
    }

    return true;
  }

  // 上传目录
  private async uploadDirectory(
    localPath: string,
    remotePath: string,
    client: any,
    deleteSource: boolean
  ): Promise<void> {
    // 创建远程目录
    await client.mkdir(remotePath);

    // 获取本地目录内容
    const items = await fs.promises.readdir(localPath, { withFileTypes: true });

    for (const item of items) {
      const localItemPath = path.join(localPath, item.name);
      const remoteItemPath = path.posix.join(remotePath, item.name);

      if (item.isFile()) {
        const result = await client.put(localItemPath, remoteItemPath);
        if (!result.success) {
          throw new Error(`上传文件失败: ${result.message}`);
        }
      } else if (item.isDirectory()) {
        await this.uploadDirectory(
          localItemPath,
          remoteItemPath,
          client,
          false
        );
      }
    }

    // 如果需要删除源目录
    if (deleteSource) {
      try {
        await fs.promises.rm(localPath, { recursive: true });
      } catch (error) {
        console.warn(`删除源目录失败: ${localPath}`, error);
      }
    }
  }

  // 下载目录
  private async downloadDirectory(
    remotePath: string,
    localPath: string,
    client: any,
    deleteSource: boolean
  ): Promise<void> {
    // 创建本地目录
    await fs.promises.mkdir(localPath, { recursive: true });

    // 获取远程目录内容
    const items = await client.list(remotePath);

    for (const item of items) {
      const remoteItemPath = path.posix.join(remotePath, item.name);
      const localItemPath = path.join(localPath, item.name);

      if (item.type === "file") {
        const result = await client.get(remoteItemPath, localItemPath);
        if (!result.success) {
          throw new Error(`下载文件失败: ${result.message}`);
        }
      } else if (item.type === "directory") {
        await this.downloadDirectory(
          remoteItemPath,
          localItemPath,
          client,
          false
        );
      }
    }

    // 如果需要删除源目录
    if (deleteSource) {
      await client.delete(remotePath);
    }
  }

  // 检查剪贴板是否有内容
  hasClipboardData(): boolean {
    return this.clipboardData !== null;
  }

  // 获取剪贴板内容
  getClipboardData(): ClipboardItem | null {
    return this.clipboardData;
  }

  // 清空剪贴板
  clearClipboard(): void {
    this.clipboardData = null;
  }

  // 检查是否有本地文件的剪贴板数据
  hasLocalFiles(): boolean {
    return this.clipboardData?.sourceConnectionId === "__LOCAL__";
  }
}
