import * as vscode from "vscode";

// SFTP连接配置接口
export interface SFTPConnectionConfig {
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKeyPath?: string;
  remotePath: string;
  protocol: "sftp";
}

// 连接状态枚举
export enum ConnectionStatus {
  Disconnected = "disconnected",
  Connecting = "connecting",
  Connected = "connected",
  Error = "error",
}

// 文件/目录项目接口
export interface FileItem {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  modifyTime: Date;
  permissions: string;
  isSymlink?: boolean;
  connectionId: string;
}

// Tree View项目类型
export type TreeItemType =
  | "connection-disconnected"
  | "connection-connected"
  | "connection-connecting"
  | "connection-error"
  | "folder"
  | "file";

// SFTP操作结果接口
export interface SFTPOperationResult {
  success: boolean;
  message?: string;
  error?: Error;
}

// 进度回调接口
export interface ProgressCallback {
  (progress: number, total: number): void;
}

// SFTP客户端接口
export interface SFTPClient {
  connect(config: SFTPConnectionConfig): Promise<SFTPOperationResult>;
  disconnect(): Promise<void>;
  list(remotePath: string): Promise<FileItem[]>;
  exists(remotePath: string): Promise<boolean>;
  get(
    remotePath: string,
    localPath: string,
    callback?: ProgressCallback
  ): Promise<SFTPOperationResult>;
  put(
    localPath: string,
    remotePath: string,
    callback?: ProgressCallback
  ): Promise<SFTPOperationResult>;
  delete(remotePath: string): Promise<SFTPOperationResult>;
  mkdir(remotePath: string): Promise<SFTPOperationResult>;
  rmdir(remotePath: string): Promise<SFTPOperationResult>;
  rename(oldPath: string, newPath: string): Promise<SFTPOperationResult>;
  chmod(remotePath: string, mode: string): Promise<SFTPOperationResult>;
  stat(remotePath: string): Promise<FileItem | null>;
}

// 连接管理器状态
export interface ConnectionState {
  config: SFTPConnectionConfig;
  status: ConnectionStatus;
  client?: SFTPClient;
  lastError?: string;
  currentPath: string;
}

// 文件系统事件类型
export type FileSystemEventType = "created" | "changed" | "deleted";

// 文件系统事件
export interface FileSystemEvent {
  type: FileSystemEventType;
  uri: vscode.Uri;
  timestamp: Date;
}

// 输出通道日志级别
export enum LogLevel {
  Debug = "DEBUG",
  Info = "INFO",
  Warning = "WARNING",
  Error = "ERROR",
}

// 同步选项
export interface SyncOptions {
  direction: "upload" | "download" | "both";
  deleteExtraFiles: boolean;
  preserveTimestamps: boolean;
  excludePatterns?: string[];
  includePatterns?: string[];
}

// 剪贴板操作类型
export type ClipboardOperationType = "copy" | "cut";

// 剪贴板项目接口
export interface ClipboardItem {
  operation: ClipboardOperationType;
  items: FileItem[];
  sourceConnectionId: string;
  timestamp: Date;
}

// 拖拽操作结果
export interface DragDropResult {
  success: boolean;
  message?: string;
  error?: Error;
}

export default {};
