// File System Access API pieces that TypeScript's DOM lib doesn't ship yet (Chromium/Edge only).
interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}
interface FileSystemHandle {
  queryPermission(d?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(d?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}
interface DirectoryPickerOptions {
  id?: string;
  mode?: 'read' | 'readwrite';
  startIn?: string | FileSystemHandle;
}
interface Window {
  showDirectoryPicker(o?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
}
