export interface VecCapability {
  readonly available: boolean;
  readonly reason?: string;
}

export interface DatabaseDriver {
  execute(sql: string, params?: any[]): Promise<any>;
}

export async function detectVecSupport(db: DatabaseDriver): Promise<VecCapability> {
  try {
    await db.execute("SELECT vec_version()");
    return { available: true };
  } catch (error) {
    return { available: false, reason: String(error) };
  }
}
