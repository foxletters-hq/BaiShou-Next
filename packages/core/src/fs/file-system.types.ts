export interface FileStat {
  isFile: boolean
  isDirectory: boolean
}

/**
 * Cross-platform file I/O abstraction for shared @baishou/core services.
 * Desktop uses {@link NodeFileSystem}; mobile injects an Expo or other adapter.
 */
export interface IFileSystem {
  exists(path: string): Promise<boolean>

  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>

  /**
   * Read a UTF-8 text file.
   * @throws Error with `code: 'ENOENT'` when the file is missing (Node-compatible).
   */
  readFile(path: string, encoding: 'utf8'): Promise<string>

  writeFile(path: string, data: string, encoding: 'utf8'): Promise<void>

  /**
   * Remove a file. Matches Node: throws `ENOENT` when missing unless the caller catches it.
   */
  unlink(path: string): Promise<void>

  /**
   * List entry names in a directory (not full paths).
   * Matches Node `fs.promises.readdir`: throws `ENOENT` when the directory does not exist.
   * Callers that need a missing directory to behave like an empty listing must catch `ENOENT`.
   */
  readdir(path: string): Promise<string[]>

  stat(path: string): Promise<FileStat>

  /** Atomic rename; used by settings atomic writes. */
  rename(oldPath: string, newPath: string): Promise<void>

  rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>
}
