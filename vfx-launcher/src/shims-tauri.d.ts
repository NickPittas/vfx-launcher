// Allow importing Tauri API without type errors
declare module '@tauri-apps/api/core' {
  /**
   * Invoke a Tauri command defined in Rust.
   * @param cmd The command identifier
   * @param args Optional arguments
   * @returns A promise resolving to the command's return value
   */
  export function invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T>;
}

declare module '@tauri-apps/api/shell' {
  /**
   * Open a file or URL in the default application.
   * @param path File or URL to open
   * @returns A promise resolving once the command has been executed
   */
  export function open(path: string): Promise<void>;
}

declare module '@tauri-apps/api/dialog' {
  interface OpenDialogOptions {
    /** Initial directory or file path. */
    defaultPath?: string;
    /** Dialog title. */
    title?: string;
    /** Whether the dialog allows multiple selection or not */
    multiple?: boolean;
    /** Whether the dialog allows selection of directories. */
    directory?: boolean;
  }

  /**
   * Open a file/directory selection dialog
   * @param options Configuration for the dialog
   * @returns A promise resolving to the selected path(s)
   */
  export function open(options?: OpenDialogOptions): Promise<string | string[] | null>;
}
