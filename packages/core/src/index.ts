export * from './diary/diary.service';
export * from './diary/file-sync.service';
export * from './diary/vault-index.service';
export * from './diary/diary-export.service';
export * from './services/agent.service';
export * from './vault/vault.types';
export * from './vault/storage-path.types';
export * from './vault/vault.errors';
export * from './vault/vault.service';
export * from './attachments/attachment-manager.types';
export * from './attachments/attachment-manager.service';
export * from './diary/diary.types';

// 会话漫游与数据流 SSOT 基建
export * from './session/session-file.service';
export * from './session/session-sync.service';
export * from './session/session-manager.service';

// AI 助手预设漫游
export * from './assistant/assistant-file.service';
export * from './assistant/assistant-manager.service';

// 全局设置漫游
export * from './settings/settings-file.service';
export * from './settings/settings-manager.service';

export * from './session/compression-prompt';
export * from './session/compression.service';
export * from './session/context-window';
export * from './session/system-prompt-builder';
export * from './session/model-pricing.service';
export * from './session/memory-deduplication.service';

// 总结生成与漫游
export * from './summary/summary-prompt-templates';
export * from './summary/summary-generator.service';
export * from './vault/summary-file.service';
export * from './summary/summary-sync.service';
export * from './summary/summary-manager.service';
export * from './summary/missing-summary-detector.service';

// 存档系统
export * from './archive/archive.interface';

// 旧版数据导入兼容
export * from './import/legacy-import.service';

// 局域网系统
export * from './network/lan-sync.interface';

// 云同步系统
export * from './network/cloud-sync.interface';

// 版本控制系统
export * from './sync/git-sync.interface';
export * from './sync/git-sync.service';
export * from './sync/incremental-sync.interface';
export * from './sync/incremental-sync.service';
export * from './sync/version-manager.interface';
export * from './sync/version-manager.service';
export * from './sync/sync.errors';

// 影子索引系统
export * from './shadow-index/shadow-index-sync.service';

// 开发阶段的内存模拟仓库——在真实数据库 Repository 就绪后替换
// export * from './__tests__/mock.agent-repository';
