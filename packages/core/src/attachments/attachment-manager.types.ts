export interface AttachmentItem {
  id: string; // Session ID for attachments folder, or the name of the folder if orphan
  name: string;
  sizeMB: number;
  isOrphan: boolean;
  fileCount: number;
  date: string;
}

export interface IAttachmentManager {
  /**
   * Imports an avatar into the local Vault Avatar pool.
   * @param absoluteSourcePath The physical path picked by the user.
   * @param prefix Optional prefix for the resulting avatar name (e.g. 'agent', 'user').
   * @returns The relative path representing the imported avatar (e.g., 'avatars/agent_123.jpg').
   *          If the source doesn't exist or fails, it should return the original input or null.
   */
  importAvatar(absoluteSourcePath: string, prefix?: string): Promise<string>;

  /**
   * Converts a Vault-relative avatar path back into an absolute URI for native desktop rendering.
   * @param relativePath The path saved in DB (e.g. 'avatars/agent_123.jpg')
   * @returns Absolute path safely resolvable by the viewer
   */
  resolveAvatarPath(relativePath: string): Promise<string>;

  /**
   * Scans the Vault Attachments directory and checks for folder names against active session criteria.
   * @param activeSessionIds A Set of active valid UUIDs tracking valid Agent Sessions natively
   * @returns A list of calculated attachment folders
   */
  listOrphans(activeSessionIds: Set<string>): Promise<AttachmentItem[]>;

  /**
   * Bulk deletion sweep for given folder UUIDs representing Session attachments
   * @param ids The UUID folder names to nuke natively 
   */
  deleteBatch(ids: string[]): Promise<void>;
}
