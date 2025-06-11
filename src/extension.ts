// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { ConnectionManager } from "./connectionManager";
import { SFTPTreeDataProvider, TreeItem } from "./treeDataProvider";
import { SFTPConnectionConfig, FileItem, ConnectionStatus } from "./types";
import { ClipboardManager } from "./clipboardManager";

let connectionManager: ConnectionManager;
let treeDataProvider: SFTPTreeDataProvider;
let clipboardManager: ClipboardManager;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log("SFTP Explorer 插件已激活");

  // 初始化连接管理器
  connectionManager = new ConnectionManager(context);

  // 初始化剪贴板管理器
  clipboardManager = new ClipboardManager(context);

  // 初始化树视图数据提供者
  treeDataProvider = new SFTPTreeDataProvider(connectionManager);

  // 注册树视图
  const treeView = vscode.window.createTreeView("sftpExplorer", {
    treeDataProvider: treeDataProvider,
    showCollapseAll: true,
    canSelectMany: true,
    dragAndDropController: treeDataProvider,
  });

  // 注册所有命令
  registerCommands(context);

  // 添加到订阅列表
  context.subscriptions.push(
    treeView,
    connectionManager,
    // 监听配置变化
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("sftpExplorer.connections")) {
        connectionManager.loadConnections();
        treeDataProvider.refresh();
      }
    })
  );

  console.log("SFTP Explorer 插件初始化完成");
}

function registerCommands(context: vscode.ExtensionContext) {
  const commands = [
    vscode.commands.registerCommand("sftpExplorer.refresh", () => {
      treeDataProvider.refresh();
      vscode.window.showInformationMessage("SFTP Explorer 已刷新");
    }),

    vscode.commands.registerCommand(
      "sftpExplorer.refreshFolder",
      async (item: TreeItem) => {
        if (item && item.connectionName) {
          if (
            item.itemType === "folder" ||
            item.itemType.includes("connection")
          ) {
            const pathToRefresh = item.remotePath || "/";
            treeDataProvider.refreshPath(item.connectionName, pathToRefresh);
            vscode.window.showInformationMessage(
              `已刷新文件夹: ${pathToRefresh}`
            );
          } else {
            vscode.window.showWarningMessage("请在文件夹上使用刷新功能");
          }
        } else {
          vscode.window.showErrorMessage("未找到有效的文件夹信息");
        }
      }
    ),

    vscode.commands.registerCommand("sftpExplorer.addConnection", async () => {
      await showConnectionDialog();
    }),

    vscode.commands.registerCommand(
      "sftpExplorer.editConnection",
      async (item: TreeItem) => {
        if (item.connectionName) {
          await showConnectionDialog(item.connectionName);
        }
      }
    ),

    vscode.commands.registerCommand(
      "sftpExplorer.deleteConnection",
      async (item: TreeItem) => {
        if (item.connectionName) {
          await deleteConnection(item.connectionName);
        }
      }
    ),

    vscode.commands.registerCommand(
      "sftpExplorer.connect",
      async (item: TreeItem) => {
        if (item.connectionName) {
          await connectToServer(item.connectionName);
        }
      }
    ),

    vscode.commands.registerCommand(
      "sftpExplorer.disconnect",
      async (item: TreeItem) => {
        if (item.connectionName) {
          await disconnectFromServer(item.connectionName);
        }
      }
    ),

    vscode.commands.registerCommand(
      "sftpExplorer.createFile",
      async (item: TreeItem) => {
        if (item.connectionName) {
          // 如果是连接项，使用连接的根路径
          const targetPath =
            item.remotePath || getConnectionRootPath(item.connectionName);
          await createRemoteFile(item.connectionName, targetPath);
        }
      }
    ),

    vscode.commands.registerCommand(
      "sftpExplorer.createFolder",
      async (item: TreeItem) => {
        if (item.connectionName) {
          // 如果是连接项，使用连接的根路径
          const targetPath =
            item.remotePath || getConnectionRootPath(item.connectionName);
          await createRemoteFolder(item.connectionName, targetPath);
        }
      }
    ),

    vscode.commands.registerCommand(
      "sftpExplorer.rename",
      async (item: TreeItem) => {
        if (item.connectionName && item.remotePath && item.fileItem) {
          await renameRemoteItem(item.connectionName, item.fileItem);
        }
      }
    ),

    vscode.commands.registerCommand(
      "sftpExplorer.delete",
      async (item: TreeItem, selectedItems?: TreeItem[]) => {
        if (item.connectionName && item.remotePath && item.fileItem) {
          // 处理多选情况
          const itemsToDelete = selectedItems?.length
            ? selectedItems
                .filter(
                  (i) => i.fileItem && i.connectionName === item.connectionName
                )
                .map((i) => i.fileItem!)
            : [item.fileItem];

          if (itemsToDelete.length > 0) {
            await deleteRemoteItems(item.connectionName, itemsToDelete);
          }
        }
      }
    ),

    vscode.commands.registerCommand(
      "sftpExplorer.downloadFile",
      async (item: TreeItem) => {
        if (
          item.connectionName &&
          item.fileItem &&
          item.fileItem.type === "file"
        ) {
          await downloadFile(item.connectionName, item.fileItem);
        }
      }
    ),

    vscode.commands.registerCommand(
      "sftpExplorer.uploadFile",
      async (item: TreeItem) => {
        if (item.connectionName) {
          // 如果是连接项，使用连接的根路径
          const targetPath =
            item.remotePath || getConnectionRootPath(item.connectionName);
          await uploadFile(item.connectionName, targetPath);
        }
      }
    ),

    vscode.commands.registerCommand(
      "sftpExplorer.openFile",
      async (fileItem: FileItem) => {
        await openRemoteFile(fileItem);
      }
    ),

    vscode.commands.registerCommand(
      "sftpExplorer.openTerminal",
      async (item: TreeItem) => {
        if (!item.connectionName) {
          vscode.window.showErrorMessage("未找到连接信息");
          return;
        }
        if (item.itemType === "file") {
          await openTerminal(
            item.connectionName,
            item.remotePath?.replace(item.fileItem?.name || "", "")
          );
        } else {
          await openTerminal(item.connectionName, item.remotePath);
        }
      }
    ),

    vscode.commands.registerCommand(
      "sftpExplorer.copy",
      async (item: TreeItem, selectedItems?: TreeItem[]) => {
        if (item.fileItem && item.connectionName) {
          // 处理多选情况
          const itemsToCopy = selectedItems?.length
            ? selectedItems
                .filter(
                  (i) => i.fileItem && i.connectionName === item.connectionName
                )
                .map((i) => i.fileItem!)
            : [item.fileItem];

          if (itemsToCopy.length > 0) {
            await copyItems(itemsToCopy, item.connectionName);
          }
        }
      }
    ),

    vscode.commands.registerCommand(
      "sftpExplorer.cut",
      async (item: TreeItem, selectedItems?: TreeItem[]) => {
        if (item.fileItem && item.connectionName) {
          // 处理多选情况
          const itemsToCut = selectedItems?.length
            ? selectedItems
                .filter(
                  (i) => i.fileItem && i.connectionName === item.connectionName
                )
                .map((i) => i.fileItem!)
            : [item.fileItem];

          if (itemsToCut.length > 0) {
            await cutItems(itemsToCut, item.connectionName);
          }
        }
      }
    ),

    vscode.commands.registerCommand(
      "sftpExplorer.paste",
      async (item: TreeItem) => {
        if (item.connectionName) {
          // 如果是连接项，使用连接的根路径
          const targetPath =
            item.remotePath || getConnectionRootPath(item.connectionName);
          await pasteItems(item.connectionName, targetPath);
        }
      }
    ),

    vscode.commands.registerCommand(
      "sftpExplorer.handleDrop",
      async (dragData: any[], target: TreeItem) => {
        await handleDropOperation(dragData, target);
      }
    ),

    vscode.commands.registerCommand(
      "sftpExplorer.handleExternalDrop",
      async (fileUris: vscode.Uri[], target: TreeItem) => {
        await handleExternalFileUpload(fileUris, target);
      }
    ),

    // 新增：从本地文件浏览器复制文件到SFTP
    vscode.commands.registerCommand(
      "sftpExplorer.copyFromExplorer",
      async (uri: vscode.Uri) => {
        await copyFromNativeExplorer(uri);
      }
    ),

    // 新增：下载SFTP文件到本地并复制到剪贴板
    vscode.commands.registerCommand(
      "sftpExplorer.copyToExplorer",
      async (item: TreeItem) => {
        if (item.fileItem && item.connectionName) {
          await copyToNativeExplorer(item.fileItem, item.connectionName);
        }
      }
    ),

    vscode.commands.registerCommand(
      "sftpExplorer.search",
      async (item?: TreeItem) => {
        await showSearchDialog(item);
      }
    ),
  ];

  context.subscriptions.push(...commands);
  console.log("命令注册完成");
}

// 显示连接配置对话框
async function showConnectionDialog(
  existingConnectionName?: string
): Promise<void> {
  const existingConnection = existingConnectionName
    ? connectionManager.getConnection(existingConnectionName)?.config
    : undefined;

  const name = await vscode.window.showInputBox({
    prompt: "输入连接名称",
    value: existingConnection?.name || "",
    validateInput: (value) => {
      if (!value.trim()) {
        return "连接名称不能为空";
      }
      if (!existingConnectionName && connectionManager.getConnection(value)) {
        return "连接名称已存在";
      }
      return null;
    },
  });

  if (!name) return;

  const host = await vscode.window.showInputBox({
    prompt: "输入服务器地址",
    value: existingConnection?.host || "",
    validateInput: (value) => (value.trim() ? null : "服务器地址不能为空"),
  });

  if (!host) return;

  const portString = await vscode.window.showInputBox({
    prompt: "输入端口号",
    value: existingConnection?.port?.toString() || "22",
    validateInput: (value) => {
      const port = parseInt(value);
      return port > 0 && port <= 65535 ? null : "请输入有效的端口号 (1-65535)";
    },
  });

  if (!portString) return;
  const port = parseInt(portString);

  const username = await vscode.window.showInputBox({
    prompt: "输入用户名",
    value: existingConnection?.username || "",
    validateInput: (value) => (value.trim() ? null : "用户名不能为空"),
  });

  if (!username) return;

  const authMethod = await vscode.window.showQuickPick(
    [
      { label: "密码认证", value: "password" },
      { label: "私钥认证", value: "privateKey" },
    ],
    { placeHolder: "选择认证方式" }
  );

  if (!authMethod) return;

  let password: string | undefined;
  let privateKeyPath: string | undefined;

  if (authMethod.value === "password") {
    password = await vscode.window.showInputBox({
      prompt: "输入密码",
      password: true,
      value: existingConnection?.password || "",
    });
    if (password === undefined) return;
  } else {
    const keyFiles = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: { 私钥文件: ["*"], 所有文件: ["*"] },
      title: "选择私钥文件",
    });

    if (!keyFiles || keyFiles.length === 0) {
      privateKeyPath = await vscode.window.showInputBox({
        prompt: "输入私钥文件路径",
        value: existingConnection?.privateKeyPath || "",
      });
      if (!privateKeyPath) return;
    } else {
      privateKeyPath = keyFiles[0].fsPath;
    }
  }

  const remotePath = await vscode.window.showInputBox({
    prompt: "输入远程路径",
    value: existingConnection?.remotePath || "/",
    validateInput: (value) => (value.trim() ? null : "远程路径不能为空"),
  });

  if (!remotePath) return;

  // 默认使用SFTP协议
  const protocol = { label: "SFTP", value: "sftp" };

  const config: SFTPConnectionConfig = {
    name: name.trim(),
    host: host.trim(),
    port,
    username: username.trim(),
    password,
    privateKeyPath,
    remotePath: remotePath.trim(),
    protocol: "sftp",
  };

  try {
    if (existingConnectionName) {
      await connectionManager.updateConnection(existingConnectionName, config);
      vscode.window.showInformationMessage(`连接 "${config.name}" 已更新`);
    } else {
      await connectionManager.addConnection(config);
      vscode.window.showInformationMessage(`连接 "${config.name}" 已添加`);
    }
    treeDataProvider.refresh();
  } catch (error) {
    vscode.window.showErrorMessage(
      `操作失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function deleteConnection(connectionName: string): Promise<void> {
  const choice = await vscode.window.showWarningMessage(
    `确定要删除连接 "${connectionName}" 吗？`,
    { modal: true },
    "删除"
  );

  if (choice === "删除") {
    try {
      await connectionManager.deleteConnection(connectionName);
      treeDataProvider.refresh();
      vscode.window.showInformationMessage(`连接 "${connectionName}" 已删除`);
    } catch (error) {
      vscode.window.showErrorMessage(
        `删除连接失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

async function connectToServer(connectionName: string): Promise<void> {
  try {
    const success = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `连接到 ${connectionName}...`,
        cancellable: true,
      },
      async (progress, token) => {
        // 检查是否已取消
        if (token.isCancellationRequested) {
          connectionManager.cancelConnection(connectionName);
          return false;
        }

        // 监听取消事件
        const onCancelledHandler = token.onCancellationRequested(() => {
          connectionManager.cancelConnection(connectionName);
          vscode.window.showInformationMessage(
            `已取消连接到 "${connectionName}"`
          );
        });

        try {
          const result = await connectionManager.connect(connectionName, token);
          onCancelledHandler.dispose();

          // 如果被取消了，确保状态正确
          if (token.isCancellationRequested) {
            connectionManager.cancelConnection(connectionName);
            return false;
          }

          return result;
        } catch (error) {
          onCancelledHandler.dispose();
          // 确保连接失败时状态正确重置
          connectionManager.cancelConnection(connectionName);
          throw error;
        }
      }
    );

    // 无论成功还是失败，都刷新树视图以显示正确的状态
    treeDataProvider.refresh();

    if (success) {
      vscode.window.showInformationMessage(`已连接到 "${connectionName}"`);
    } else {
      const state = connectionManager.getConnection(connectionName);
      // 只在真的连接失败时显示错误，取消操作不显示错误
      if (state?.lastError && !state.lastError.includes("取消")) {
        vscode.window.showErrorMessage(`连接失败: ${state.lastError}`);
      }
    }
  } catch (error) {
    // 确保异常时也刷新视图
    treeDataProvider.refresh();

    if (!(error instanceof Error) || !error.message.includes("取消")) {
      vscode.window.showErrorMessage(
        `连接异常: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

async function disconnectFromServer(connectionName: string): Promise<void> {
  try {
    await connectionManager.disconnect(connectionName);
    treeDataProvider.refresh();
    vscode.window.showInformationMessage(`已断开连接 "${connectionName}"`);
  } catch (error) {
    vscode.window.showErrorMessage(
      `断开连接失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function createRemoteFile(
  connectionName: string,
  parentPath: string
): Promise<void> {
  const fileName = await vscode.window.showInputBox({
    prompt: "输入文件名",
    validateInput: (value) => {
      if (!value.trim()) {
        return "文件名不能为空";
      }
      if (value.includes("/") || value.includes("\\")) {
        return "文件名不能包含路径分隔符";
      }
      return null;
    },
  });

  if (!fileName) return;

  try {
    const state = connectionManager.getConnection(connectionName);
    if (!state?.client) {
      vscode.window.showErrorMessage("未连接到服务器");
      return;
    }

    const filePath = path.posix.join(parentPath, fileName);
    const tempFile = path.join(require("os").tmpdir(), fileName);
    await fs.promises.writeFile(tempFile, "");

    const result = await state.client.put(tempFile, filePath);

    try {
      await fs.promises.unlink(tempFile);
    } catch (e) {
      // 忽略清理错误
    }

    if (result.success) {
      treeDataProvider.refreshPath(connectionName, parentPath);
      vscode.window.showInformationMessage(`文件 "${fileName}" 创建成功`);
    } else {
      vscode.window.showErrorMessage(`创建文件失败: ${result.message}`);
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      `创建文件失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function createRemoteFolder(
  connectionName: string,
  parentPath: string
): Promise<void> {
  const folderName = await vscode.window.showInputBox({
    prompt: "输入文件夹名",
    validateInput: (value) => {
      if (!value.trim()) {
        return "文件夹名不能为空";
      }
      if (value.includes("/") || value.includes("\\")) {
        return "文件夹名不能包含路径分隔符";
      }
      return null;
    },
  });

  if (!folderName) return;

  try {
    const state = connectionManager.getConnection(connectionName);
    if (!state?.client) {
      vscode.window.showErrorMessage("未连接到服务器");
      return;
    }

    const folderPath = path.posix.join(parentPath, folderName);
    const result = await state.client.mkdir(folderPath);

    if (result.success) {
      treeDataProvider.refreshPath(connectionName, parentPath);
      vscode.window.showInformationMessage(`文件夹 "${folderName}" 创建成功`);
    } else {
      vscode.window.showErrorMessage(`创建文件夹失败: ${result.message}`);
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      `创建文件夹失败: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

async function renameRemoteItem(
  connectionName: string,
  fileItem: FileItem
): Promise<void> {
  const newName = await vscode.window.showInputBox({
    prompt: `重命名 ${fileItem.type === "directory" ? "文件夹" : "文件"}`,
    value: fileItem.name,
    validateInput: (value) => {
      if (!value.trim()) {
        return "名称不能为空";
      }
      if (value.includes("/") || value.includes("\\")) {
        return "名称不能包含路径分隔符";
      }
      if (value === fileItem.name) {
        return "新名称与原名称相同";
      }
      return null;
    },
  });

  if (!newName) return;

  try {
    const state = connectionManager.getConnection(connectionName);
    if (!state?.client) {
      vscode.window.showErrorMessage("未连接到服务器");
      return;
    }

    const oldPath = fileItem.path;
    const newPath = path.posix.join(path.posix.dirname(oldPath), newName);
    const result = await state.client.rename(oldPath, newPath);

    if (result.success) {
      const parentPath = path.posix.dirname(oldPath);
      treeDataProvider.refreshPath(connectionName, parentPath);
      vscode.window.showInformationMessage(result.message || "重命名成功");
    } else {
      vscode.window.showErrorMessage(`重命名失败: ${result.message}`);
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      `重命名失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function deleteRemoteItem(
  connectionName: string,
  fileItem: FileItem
): Promise<void> {
  await deleteRemoteItems(connectionName, [fileItem]);
}

async function deleteRemoteItems(
  connectionName: string,
  fileItems: FileItem[]
): Promise<void> {
  if (fileItems.length === 0) return;

  const fileCount = fileItems.filter((item) => item.type === "file").length;
  const folderCount = fileItems.filter(
    (item) => item.type === "directory"
  ).length;

  let message = "确定要删除 ";
  if (fileCount > 0) {
    message += `${fileCount} 个文件`;
  }
  if (folderCount > 0) {
    if (fileCount > 0) message += " 和 ";
    message += `${folderCount} 个文件夹`;
  }
  message += " 吗？";

  const choice = await vscode.window.showWarningMessage(
    message,
    { modal: true },
    "删除"
  );

  if (choice !== "删除") return;

  try {
    const state = connectionManager.getConnection(connectionName);
    if (!state?.client) {
      vscode.window.showErrorMessage("未连接到服务器");
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `删除 ${fileItems.length} 个项目...`,
        cancellable: true,
      },
      async (progress, token) => {
        let completed = 0;
        const errors: string[] = [];

        for (const fileItem of fileItems) {
          if (token.isCancellationRequested) {
            vscode.window.showInformationMessage("删除操作已取消");
            return;
          }

          try {
            const result = await state.client!.delete(fileItem.path);
            if (!result.success) {
              errors.push(`${fileItem.name}: ${result.message}`);
            }
          } catch (error) {
            errors.push(
              `${fileItem.name}: ${error instanceof Error ? error.message : String(error)}`
            );
          }

          completed++;
          progress.report({
            increment: (completed / fileItems.length) * 100,
            message: `已删除 ${completed}/${fileItems.length}`,
          });
        }

        // 刷新所有受影响的父目录
        const parentPaths = [
          ...new Set(fileItems.map((item) => path.posix.dirname(item.path))),
        ];
        for (const parentPath of parentPaths) {
          treeDataProvider.refreshPath(connectionName, parentPath);
        }

        if (errors.length === 0) {
          vscode.window.showInformationMessage(
            `成功删除 ${fileItems.length} 个项目`
          );
        } else if (errors.length < fileItems.length) {
          vscode.window.showWarningMessage(
            `部分删除成功，${errors.length} 个项目删除失败:\n${errors.join("\n")}`
          );
        } else {
          vscode.window.showErrorMessage(`删除失败:\n${errors.join("\n")}`);
        }
      }
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `删除失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function downloadFile(
  connectionName: string,
  fileItem: FileItem
): Promise<void> {
  const saveDialog = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(fileItem.name),
    title: "保存文件到...",
  });

  if (!saveDialog) return;

  try {
    const state = connectionManager.getConnection(connectionName);
    if (!state?.client) {
      vscode.window.showErrorMessage("未连接到服务器");
      return;
    }

    const cancelled = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `下载文件 ${fileItem.name}...`,
        cancellable: true,
      },
      async (progress, token) => {
        return new Promise<boolean>((resolve, reject) => {
          if (token.isCancellationRequested) {
            resolve(true);
            return;
          }

          const onCancelledHandler = token.onCancellationRequested(() => {
            vscode.window.showInformationMessage(
              `已取消下载文件 "${fileItem.name}"`
            );
            onCancelledHandler.dispose();
            resolve(true);
          });

          state
            .client!.get(
              fileItem.path,
              saveDialog.fsPath,
              (transferred, total) => {
                if (token.isCancellationRequested) {
                  return;
                }
                const percent = Math.round((transferred / total) * 100);
                progress.report({
                  increment: percent / 100,
                  message: `${percent}% (${formatBytes(transferred)}/${formatBytes(total)})`,
                });
              }
            )
            .then((result) => {
              onCancelledHandler.dispose();
              if (token.isCancellationRequested) {
                resolve(true);
                return;
              }

              if (result.success) {
                vscode.window.showInformationMessage(
                  result.message || "下载成功"
                );
                resolve(false);
              } else {
                vscode.window.showErrorMessage(`下载失败: ${result.message}`);
                resolve(false);
              }
            })
            .catch((error) => {
              onCancelledHandler.dispose();
              reject(error);
            });
        });
      }
    );

    if (cancelled) {
      return;
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      `下载失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function uploadFile(
  connectionName: string,
  remotePath: string
): Promise<void> {
  const openDialog = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    title: "选择要上传的文件",
  });

  if (!openDialog || openDialog.length === 0) return;

  const localFile = openDialog[0];

  try {
    const state = connectionManager.getConnection(connectionName);
    if (!state?.client) {
      vscode.window.showErrorMessage("未连接到服务器");
      return;
    }

    const fileName = path.basename(localFile.fsPath);
    const remoteFilePath = path.posix.join(remotePath, fileName);

    const cancelled = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `上传文件 ${fileName}...`,
        cancellable: true,
      },
      async (progress, token) => {
        return new Promise<boolean>((resolve, reject) => {
          if (token.isCancellationRequested) {
            resolve(true);
            return;
          }

          const onCancelledHandler = token.onCancellationRequested(() => {
            vscode.window.showInformationMessage(
              `已取消上传文件 "${fileName}"`
            );
            onCancelledHandler.dispose();
            resolve(true);
          });

          state
            .client!.put(
              localFile.fsPath,
              remoteFilePath,
              (transferred, total) => {
                if (token.isCancellationRequested) {
                  return;
                }
                const percent = Math.round((transferred / total) * 100);
                progress.report({
                  increment: percent / 100,
                  message: `${percent}% (${formatBytes(transferred)}/${formatBytes(total)})`,
                });
              }
            )
            .then((result) => {
              onCancelledHandler.dispose();
              if (token.isCancellationRequested) {
                resolve(true);
                return;
              }

              if (result.success) {
                treeDataProvider.refreshPath(connectionName, remotePath);
                vscode.window.showInformationMessage(
                  result.message || "上传成功"
                );
                resolve(false);
              } else {
                vscode.window.showErrorMessage(`上传失败: ${result.message}`);
                resolve(false);
              }
            })
            .catch((error) => {
              onCancelledHandler.dispose();
              reject(error);
            });
        });
      }
    );

    if (cancelled) {
      return;
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      `上传失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function openRemoteFile(fileItem: FileItem): Promise<void> {
  try {
    const state = connectionManager.getConnection(fileItem.connectionId);
    if (!state?.client) {
      vscode.window.showErrorMessage("未连接到服务器");
      return;
    }

    // 显示下载进度
    const cancelled = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `正在打开文件 ${fileItem.name}...`,
        cancellable: true,
      },
      async (progress, token) => {
        if (token.isCancellationRequested) {
          return true;
        }
        const tempDir = path.join(
          require("os").tmpdir(),
          "sftp-explorer",
          fileItem.connectionId
        );
        await fs.promises.mkdir(tempDir, { recursive: true });

        // 为避免文件名冲突，使用时间戳创建唯一文件名
        const timestamp = Date.now();
        const fileExtension = path.extname(fileItem.name);
        const fileName = `${path.basename(fileItem.name, fileExtension)}_${timestamp}${fileExtension}`;
        const tempFile = path.join(tempDir, fileName);

        progress.report({ message: "正在下载文件..." });

        const result = await new Promise<any>((resolve, reject) => {
          if (token.isCancellationRequested) {
            resolve({ success: false, cancelled: true });
            return;
          }

          const onCancelledHandler = token.onCancellationRequested(() => {
            vscode.window.showInformationMessage(
              `已取消打开文件 "${fileItem.name}"`
            );
            onCancelledHandler.dispose();
            resolve({ success: false, cancelled: true });
          });

          state
            .client!.get(fileItem.path, tempFile, (transferred, total) => {
              if (token.isCancellationRequested) {
                return;
              }
              const percent = Math.round((transferred / total) * 100);
              progress.report({
                increment: percent,
                message: `下载中... ${percent}% (${formatBytes(transferred)}/${formatBytes(total)})`,
              });
            })
            .then((downloadResult) => {
              onCancelledHandler.dispose();
              if (token.isCancellationRequested) {
                resolve({ success: false, cancelled: true });
              } else {
                resolve(downloadResult);
              }
            })
            .catch((error) => {
              onCancelledHandler.dispose();
              reject(error);
            });
        });

        if (result.cancelled) {
          return true; // 返回true表示操作被取消
        }

        if (result.success) {
          if (token.isCancellationRequested) {
            return true;
          }

          progress.report({ message: "验证文件完整性..." });

          // 验证文件是否下载完整
          const stats = await fs.promises.stat(tempFile);
          if (stats.size === 0 && fileItem.size > 0) {
            throw new Error("文件下载不完整，文件大小为0");
          }

          // 等待一小段时间确保文件写入完成
          await new Promise((resolve) => setTimeout(resolve, 100));

          if (token.isCancellationRequested) {
            return true;
          }

          progress.report({ message: "打开文件..." });

          // 打开文档
          const doc = await vscode.workspace.openTextDocument(tempFile);
          await vscode.window.showTextDocument(doc);

          // 在状态栏显示文件信息
          vscode.window.setStatusBarMessage(
            `SFTP: 已打开 ${fileItem.name} (${formatBytes(fileItem.size)})`,
            5000
          );

          // 设置保存监听器
          const saveDisposable = vscode.workspace.onDidSaveTextDocument(
            async (savedDoc) => {
              if (savedDoc.fileName === tempFile) {
                try {
                  const syncCancelled = await vscode.window.withProgress(
                    {
                      location: vscode.ProgressLocation.Notification,
                      title: `同步 ${fileItem.name} 到远程服务器...`,
                      cancellable: true,
                    },
                    async (syncProgress, syncToken) => {
                      return new Promise<boolean>((resolve, reject) => {
                        if (syncToken.isCancellationRequested) {
                          resolve(true);
                          return;
                        }

                        const onSyncCancelledHandler =
                          syncToken.onCancellationRequested(() => {
                            vscode.window.showInformationMessage(
                              `已取消同步文件 "${fileItem.name}"`
                            );
                            onSyncCancelledHandler.dispose();
                            resolve(true);
                          });

                        state
                          .client!.put(
                            tempFile,
                            fileItem.path,
                            (transferred, total) => {
                              if (syncToken.isCancellationRequested) {
                                return;
                              }
                              const percent = Math.round(
                                (transferred / total) * 100
                              );
                              syncProgress.report({
                                increment: percent / 100,
                                message: `上传中... ${percent}%`,
                              });
                            }
                          )
                          .then((uploadResult) => {
                            onSyncCancelledHandler.dispose();
                            if (syncToken.isCancellationRequested) {
                              resolve(true);
                              return;
                            }

                            if (uploadResult.success) {
                              vscode.window.setStatusBarMessage(
                                "SFTP: 文件已同步到远程服务器",
                                3000
                              );
                              resolve(false);
                            } else {
                              vscode.window.showErrorMessage(
                                `同步失败: ${uploadResult.message}`
                              );
                              resolve(false);
                            }
                          })
                          .catch((error) => {
                            onSyncCancelledHandler.dispose();
                            reject(error);
                          });
                      });
                    }
                  );

                  if (syncCancelled) {
                    return;
                  }
                } catch (error) {
                  vscode.window.showErrorMessage(
                    `同步失败: ${
                      error instanceof Error ? error.message : String(error)
                    }`
                  );
                }
              }
            }
          );

          // 设置关闭监听器
          const closeDisposable = vscode.workspace.onDidCloseTextDocument(
            (closedDoc) => {
              if (closedDoc.fileName === tempFile) {
                saveDisposable.dispose();
                closeDisposable.dispose();
                // 延迟删除文件，确保文档完全关闭
                setTimeout(() => {
                  fs.promises.unlink(tempFile).catch(() => {});
                }, 1000);
              }
            }
          );
          return false; // 返回false表示操作成功完成
        } else {
          throw new Error(result.message || "下载文件失败");
        }
      }
    );

    if (cancelled) {
      return; // 操作被取消，直接返回
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      `打开文件失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function getConnectionRootPath(connectionName: string): string {
  const state = connectionManager.getConnection(connectionName);
  return state?.config.remotePath || "/";
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

async function showSearchDialog(contextItem?: TreeItem): Promise<void> {
  // 获取可用的连接
  const connections = connectionManager
    .getAllConnections()
    .filter((state) => state.status === ConnectionStatus.Connected);

  if (connections.length === 0) {
    vscode.window.showErrorMessage("没有可用的连接，请先连接到SFTP服务器");
    return;
  }

  // 选择连接
  let selectedConnection: string;
  if (contextItem?.connectionName) {
    selectedConnection = contextItem.connectionName;
  } else if (connections.length === 1) {
    selectedConnection = connections[0].config.name;
  } else {
    const connectionOptions = connections.map((state) => ({
      label: state.config.name,
      description: `${state.config.username}@${state.config.host}`,
      value: state.config.name,
    }));

    const selected = await vscode.window.showQuickPick(connectionOptions, {
      placeHolder: "选择要搜索的连接",
      ignoreFocusOut: true,
    });

    if (!selected) return;
    selectedConnection = selected.value;
  }

  // 选择搜索路径
  const searchPath =
    contextItem?.remotePath || getConnectionRootPath(selectedConnection);

  // 输入搜索关键词
  const searchTerm = await vscode.window.showInputBox({
    prompt: `在 ${selectedConnection}:${searchPath} 中搜索文件`,
    placeHolder: "输入文件名或模式 (支持通配符 * 和 ?)",
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value.trim()) {
        return "搜索关键词不能为空";
      }
      return null;
    },
  });

  if (!searchTerm) return;

  await searchFiles(selectedConnection, searchPath, searchTerm);
}

async function searchFiles(
  connectionName: string,
  searchPath: string,
  searchTerm: string
): Promise<void> {
  try {
    const state = connectionManager.getConnection(connectionName);
    if (!state?.client) {
      vscode.window.showErrorMessage("连接不存在或未连接");
      return;
    }

    const results = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `在 ${connectionName} 中搜索 "${searchTerm}"...`,
        cancellable: true,
      },
      async (progress, token) => {
        const searchResults: FileItem[] = [];
        const searchQueue: string[] = [searchPath];
        let processedPaths = 0;

        while (searchQueue.length > 0 && !token.isCancellationRequested) {
          const currentPath = searchQueue.shift()!;
          processedPaths++;

          progress.report({
            increment: 1,
            message: `正在搜索: ${currentPath} (已处理 ${processedPaths} 个目录)`,
          });

          try {
            const files = await state.client!.list(currentPath);

            for (const file of files) {
              if (token.isCancellationRequested) break;

              // 检查文件名是否匹配搜索词
              if (matchesPattern(file.name, searchTerm)) {
                searchResults.push(file);
              }

              // 如果是目录，添加到搜索队列
              if (file.type === "directory") {
                searchQueue.push(file.path);
              }
            }
          } catch (error) {
            // 忽略无法访问的目录
            console.log(`无法搜索目录 ${currentPath}:`, error);
          }
        }

        return token.isCancellationRequested ? null : searchResults;
      }
    );

    if (results === null) {
      vscode.window.showInformationMessage("搜索已取消");
      return;
    }

    await showSearchResults(connectionName, searchTerm, results);
  } catch (error) {
    vscode.window.showErrorMessage(
      `搜索失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function matchesPattern(filename: string, pattern: string): boolean {
  // 将通配符模式转换为正则表达式
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&") // 转义特殊字符
    .replace(/\*/g, ".*") // * 匹配任意字符
    .replace(/\?/g, "."); // ? 匹配单个字符

  const regex = new RegExp(`^${regexPattern}$`, "i"); // 不区分大小写
  return regex.test(filename);
}

async function showSearchResults(
  connectionName: string,
  searchTerm: string,
  results: FileItem[]
): Promise<void> {
  if (results.length === 0) {
    vscode.window.showInformationMessage(`未找到匹配 "${searchTerm}" 的文件`);
    return;
  }

  const quickPickItems = results.map((file) => ({
    label: file.name,
    description: file.path,
    detail: `${file.type === "directory" ? "文件夹" : "文件"} • ${formatBytes(file.size)} • ${file.modifyTime.toLocaleString()}`,
    file: file,
  }));

  const selected = await vscode.window.showQuickPick(quickPickItems, {
    placeHolder: `找到 ${results.length} 个匹配 "${searchTerm}" 的结果`,
    ignoreFocusOut: true,
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (selected) {
    // 如果是文件，打开文件；如果是文件夹，在树视图中展开
    if (selected.file.type === "file") {
      await openRemoteFile(selected.file);
    } else {
      // 展开并高亮文件夹
      treeDataProvider.refreshPath(connectionName, selected.file.path);
      vscode.window.showInformationMessage(
        `已定位到文件夹: ${selected.file.path}`
      );
    }
  }
}

async function openTerminal(
  connectionName: string,
  remotePath?: string
): Promise<void> {
  const state = connectionManager.getConnection(connectionName);
  if (!state) {
    vscode.window.showErrorMessage("连接不存在");
    return;
  }

  const config = state.config;
  const targetPath = remotePath || config.remotePath;

  let sshCommand = `ssh ${config.username}@${config.host}`;

  if (config.port !== 22) {
    sshCommand += ` -p ${config.port}`;
  }

  if (config.privateKeyPath) {
    sshCommand += ` -i "${config.privateKeyPath}"`;
  }

  if (targetPath && targetPath !== "/") {
    sshCommand += ` -t "cd '${targetPath}' && bash"`;
  }

  const terminal = vscode.window.createTerminal({
    name: `SSH: ${connectionName}`,
    shellPath: process.platform === "win32" ? "cmd.exe" : "/bin/bash",
  });

  terminal.sendText(sshCommand);

  // 如果配置了密码，自动输入密码
  if (config.password && !config.privateKeyPath) {
    setTimeout(() => {
      terminal.sendText(config.password!);
    }, 2000); // 等待2秒让SSH命令执行并提示输入密码

    vscode.window.showInformationMessage(
      `已为连接 "${connectionName}" 自动输入密码`
    );
  }

  terminal.show();
}

// 复制文件
async function copyItems(
  items: FileItem[],
  connectionId: string
): Promise<void> {
  try {
    await clipboardManager.copy(items, connectionId);
  } catch (error) {
    vscode.window.showErrorMessage(
      `复制失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// 剪切文件
async function cutItems(
  items: FileItem[],
  connectionId: string
): Promise<void> {
  try {
    await clipboardManager.cut(items, connectionId);
  } catch (error) {
    vscode.window.showErrorMessage(
      `剪切失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// 粘贴文件
async function pasteItems(
  targetConnectionId: string,
  targetPath: string
): Promise<void> {
  try {
    const success = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "正在粘贴文件...",
        cancellable: false,
      },
      async () => {
        return await clipboardManager.paste(
          targetConnectionId,
          targetPath,
          connectionManager
        );
      }
    );

    if (success) {
      treeDataProvider.refreshPath(targetConnectionId, targetPath);
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      `粘贴失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// 处理外部文件上传
async function handleExternalFileUpload(
  fileUris: vscode.Uri[],
  target: TreeItem
): Promise<void> {
  if (!target.connectionName) {
    vscode.window.showErrorMessage("无效的目标连接");
    return;
  }

  // 确定目标路径
  let targetPath = target.remotePath;
  if (!targetPath && target.itemType.includes("connection")) {
    targetPath = "/";
  }

  if (!targetPath) {
    vscode.window.showErrorMessage("无效的目标路径");
    return;
  }

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `上传 ${fileUris.length} 个文件到远程服务器...`,
        cancellable: false,
      },
      async (progress) => {
        const state = connectionManager.getConnection(target.connectionName!);
        if (!state?.client) {
          throw new Error("连接未建立");
        }

        let completed = 0;
        for (const fileUri of fileUris) {
          const localPath = fileUri.fsPath;
          const fileName = path.basename(localPath);
          const remotePath = path.posix.join(targetPath!, fileName);

          // 检查是文件还是目录
          const stat = await fs.promises.stat(localPath);

          if (stat.isFile()) {
            const result = await state.client.put(localPath, remotePath);
            if (!result.success) {
              throw new Error(`上传文件 ${fileName} 失败: ${result.message}`);
            }
          } else if (stat.isDirectory()) {
            await uploadDirectoryRecursive(localPath, remotePath, state.client);
          }

          completed++;
          const percent = Math.round((completed / fileUris.length) * 100);
          progress.report({
            increment: percent / fileUris.length,
            message: `已完成 ${completed}/${fileUris.length} 个文件`,
          });
        }

        // 刷新目标目录
        treeDataProvider.refreshPath(target.connectionName!, targetPath!);
      }
    );

    vscode.window.showInformationMessage(`成功上传 ${fileUris.length} 个文件`);
  } catch (error) {
    vscode.window.showErrorMessage(
      `上传失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// 递归上传目录
async function uploadDirectoryRecursive(
  localDir: string,
  remoteDir: string,
  client: any
): Promise<void> {
  // 创建远程目录
  await client.mkdir(remoteDir);

  // 获取本地目录内容
  const items = await fs.promises.readdir(localDir, { withFileTypes: true });

  for (const item of items) {
    const localItemPath = path.join(localDir, item.name);
    const remoteItemPath = path.posix.join(remoteDir, item.name);

    if (item.isFile()) {
      const result = await client.put(localItemPath, remoteItemPath);
      if (!result.success) {
        throw new Error(`上传文件 ${item.name} 失败: ${result.message}`);
      }
    } else if (item.isDirectory()) {
      await uploadDirectoryRecursive(localItemPath, remoteItemPath, client);
    }
  }
}

// 从原生文件浏览器复制文件到SFTP剪贴板
async function copyFromNativeExplorer(uri: vscode.Uri): Promise<void> {
  try {
    // 将文件路径转换为FileItem格式，暂存在特殊的剪贴板中
    const localPath = uri.fsPath;
    const stat = await fs.promises.stat(localPath);

    const fileItem: FileItem = {
      name: path.basename(localPath),
      path: localPath,
      type: stat.isDirectory() ? "directory" : "file",
      size: stat.isFile() ? stat.size : 0,
      modifyTime: stat.mtime,
      permissions: "755", // 默认权限
      connectionId: "__LOCAL__", // 标记为本地文件
    };

    // 使用特殊的connectionId标记这是来自本地的
    await clipboardManager.copy([fileItem], "__LOCAL__");

    vscode.window.showInformationMessage(`已复制本地文件: ${fileItem.name}`);
  } catch (error) {
    vscode.window.showErrorMessage(
      `复制本地文件失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// 下载SFTP文件并提供给原生文件浏览器
async function copyToNativeExplorer(
  fileItem: FileItem,
  connectionName: string
): Promise<void> {
  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `下载文件 ${fileItem.name} 到本地剪贴板...`,
        cancellable: false,
      },
      async () => {
        const state = connectionManager.getConnection(connectionName);
        if (!state?.client) {
          throw new Error("连接未建立");
        }

        // 创建临时目录用于下载
        const tempDir = path.join(os.tmpdir(), "sftp-explorer-download");
        await fs.promises.mkdir(tempDir, { recursive: true });

        const localPath = path.join(tempDir, fileItem.name);

        if (fileItem.type === "file") {
          // 下载文件
          const result = await state.client.get(fileItem.path, localPath);
          if (!result.success) {
            throw new Error(`下载失败: ${result.message}`);
          }
        } else {
          // 下载目录
          await downloadDirectoryRecursive(
            fileItem.path,
            localPath,
            state.client
          );
        }

        // 将文件路径写入系统剪贴板（VS Code可以识别文件路径）
        const fileUri = vscode.Uri.file(localPath);
        await vscode.env.clipboard.writeText(fileUri.toString());

        vscode.window.showInformationMessage(
          `文件已下载到临时目录并复制到剪贴板，可在本地文件浏览器中粘贴`
        );
      }
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `下载文件失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// 递归下载目录
async function downloadDirectoryRecursive(
  remotePath: string,
  localPath: string,
  client: any
): Promise<void> {
  // 创建本地目录
  await fs.promises.mkdir(localPath, { recursive: true });

  // 获取远程目录内容
  const result = await client.list(remotePath);
  if (!result.success) {
    throw new Error(`列出目录失败: ${result.message}`);
  }

  for (const item of result.data) {
    const remoteItemPath = path.posix.join(remotePath, item.name);
    const localItemPath = path.join(localPath, item.name);

    if (item.type === "file") {
      const downloadResult = await client.get(remoteItemPath, localItemPath);
      if (!downloadResult.success) {
        throw new Error(
          `下载文件 ${item.name} 失败: ${downloadResult.message}`
        );
      }
    } else if (item.type === "folder") {
      await downloadDirectoryRecursive(remoteItemPath, localItemPath, client);
    }
  }
}

// 处理拖拽操作
async function handleDropOperation(
  dragData: any[],
  target: TreeItem
): Promise<void> {
  if (!target.connectionName || !target.remotePath) {
    return;
  }

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "正在移动文件...",
        cancellable: false,
      },
      async () => {
        // 将拖拽的项目转换为FileItem数组
        const fileItems: FileItem[] = dragData
          .filter((item) => item.fileItem)
          .map((item) => item.fileItem);

        if (fileItems.length === 0) {
          return;
        }

        // 检查是否为同一连接内的移动
        const sourceConnectionId = dragData[0].connectionName;
        const targetConnectionId = target.connectionName;

        if (sourceConnectionId === targetConnectionId) {
          // 同一连接内移动，使用剪切+粘贴
          await clipboardManager.cut(fileItems, sourceConnectionId || "");
          await clipboardManager.paste(
            targetConnectionId || "",
            target.remotePath || "",
            connectionManager
          );
        } else {
          // 不同连接间移动，使用复制+删除
          await clipboardManager.copy(fileItems, sourceConnectionId || "");
          await clipboardManager.paste(
            targetConnectionId || "",
            target.remotePath || "",
            connectionManager
          );

          // 删除源文件
          const sourceState =
            connectionManager.getConnection(sourceConnectionId);
          if (sourceState?.client) {
            for (const item of fileItems) {
              await sourceState.client.delete(item.path);
            }
          }
        }

        // 刷新相关视图
        treeDataProvider.refreshPath(
          targetConnectionId || "",
          target.remotePath || ""
        );

        // 刷新源视图
        for (const item of dragData) {
          if (item.remotePath) {
            const parentPath = path.posix.dirname(item.remotePath);
            treeDataProvider.refreshPath(item.connectionName, parentPath);
          }
        }
      }
    );

    vscode.window.showInformationMessage("文件移动完成");
  } catch (error) {
    vscode.window.showErrorMessage(
      `移动失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function deactivate() {
  if (connectionManager) {
    connectionManager.dispose();
  }
}
