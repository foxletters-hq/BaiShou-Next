#!/usr/bin/env python3
"""Build baishou-provider modules from BaishouProvider.orig.tsx with max-lines splits."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORIG_PATH = Path('/tmp/BaishouProvider.orig.tsx')
OUT = ROOT / 'apps/mobile/src/providers/baishou-provider'
ORIG = ORIG_PATH.read_text().splitlines()

REF_NAMES = [
    'retryStorageSetupRef',
    'runWithStorageQuiescedRef',
    'deleteMigratedLegacySourceRef',
    'notifyArchiveRestoreCompleteRef',
    'notifyVersionMigrationCompleteRef',
    'resyncAfterMigrationRef',
    'reloadAgentDatabaseRef',
    'archiveFullRestoreDoneRef',
    'vaultBootstrapCtxRef',
    'migrationRuntimeRef',
    'diaryStackRef',
]


def slice_body(start: int, end: int) -> str:
    lines = []
    for i in range(start, end + 1):
        line = ORIG[i - 1]
        lines.append(line[8:] if line.startswith('        ') else line)
    return '\n'.join(lines)


def prefix_refs(text: str) -> str:
    for name in REF_NAMES:
        text = re.sub(rf'(?<!refs\.)(?<!\.){re.escape(name)}', f'refs.{name}', text)
    return text.replace('refs.refs.', 'refs.')


def patch_init_text(text: str) -> str:
    text = text.replace(
        'const { buildSharedContext, buildSharedContextPreview } = createSharedContextBuilders({ diaryStackRef, summaryManager, settingsManager })',
        'const { buildSharedContext, buildSharedContextPreview } = createSharedContextBuilders({ diaryStackRef: refs.diaryStackRef, summaryManager, settingsManager })',
    )
    text = prefix_refs(text)
    text = text.replace(
        'mobileMcpService = new MobileMcpService',
        'ctx.mobileMcpServiceHolder.current = mobileMcpService = new MobileMcpService',
    )
    text = text.replace('if (!isMounted ||', 'if (!isMounted() ||')
    text = text.replace('if (!isMounted)', 'if (!isMounted())')
    text = text.replace('if (isMounted)', 'if (isMounted())')
    text = text.replace('setValue(', 'ctx.setValue(')
    return text


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + '\n')


def build_init_segments() -> dict[str, str]:
    repl = {
        677: 'const { buildSharedContext, buildSharedContextPreview } = createSharedContextBuilders({ diaryStackRef: refs.diaryStackRef, summaryManager, settingsManager })',
        750: 'const archiveDbBridge = createArchiveDbBridge({ fileSystem, pathService, vaultService, refs, isMounted, setValue: ctx.setValue })',
        1033: 'const memorySearch = createMemorySearch({ pathService, registry, agentDbRuntimeRef })',
        1113: 'const startAgentChat = createStartAgentChat({ agentService, toolRegistry, registry, agentDbRuntimeRef, getDiarySearcher })',
        1268: 'assignReloadAgentDatabaseHandler(ctx, { openAgentDatabase, vaultService, pathService, toolRegistry, archiveService, syncDeviceId, getDiarySearcher, diaryServiceProxy, setValue: ctx.setValue })',
        1878: 'const getContextAtMessage = createGetContextAtMessage({ toolRegistry, agentDbRuntimeRef, getDiarySearcher })',
    }
    skip = set()
    for start, end in [(677, 720), (750, 943), (1033, 1111), (1113, 1228), (1268, 1406), (1878, 1898)]:
        skip.update(range(start, end + 1))

    chunks: dict[str, list[str]] = {
        'agent_db': [],
        'sync_layer': [],
        'vault_handlers': [],
        'storage_refs': [],
        'ready_state': [],
    }
    current = 'agent_db'
    for i in range(309, 2063):
        if i in repl:
            line = repl[i]
        elif i in skip:
            continue
        else:
            line = ORIG[i - 1]
            line = line[8:] if line.startswith('        ') else line
        if i == 1427:
            current = 'vault_handlers'
        elif i == 1113 and 'retryStorageSetupRef.current' in line:
            current = 'storage_refs'
        elif 'void getTtsPlaybackSettings' in line:
            current = 'ready_state'
        if i == 1113:
            current = 'sync_layer'
        if i == 1427:
            current = 'vault_handlers'
        if i == 1113:
            pass
        chunks[current].append(line)

    # Rebuild using explicit ranges
    agent_db = patch_init_text(slice_body(309, 748))
    sync_layer = patch_init_text(slice_body(749, 1425).replace(
        slice_body(677, 720),
        'const { buildSharedContext, buildSharedContextPreview } = createSharedContextBuilders({ diaryStackRef: refs.diaryStackRef, summaryManager, settingsManager })',
    ))
    # manual range rebuild
    def ranged(start: int, end: int, inserts: dict[int, str]) -> str:
        lines = []
        for i in range(start, end + 1):
            if i in inserts:
                lines.append(inserts[i])
                continue
            if i in skip:
                continue
            line = ORIG[i - 1]
            lines.append(line[8:] if line.startswith('        ') else line)
        return patch_init_text('\n'.join(lines))

    inserts = repl
    agent_db = ranged(309, 748, {677: repl[677]})
    sync_layer = ranged(749, 1425, {750: repl[750], 1033: repl[1033], 1113: repl[1113], 1268: repl[1268]})
    vault_handlers = ranged(1427, 1900, {1878: repl[1878]})
    storage_start = vault_handlers.find('refs.retryStorageSetupRef.current = async')
    if storage_start == -1:
        storage_handlers = ''
        vault_only = vault_handlers
    else:
        vault_only = vault_handlers[:storage_start]
        storage_handlers = vault_handlers[storage_start:]
    ready_state = ranged(1901, 2062, {})

    return {
        'agent_db': agent_db,
        'sync_layer': sync_layer,
        'vault_handlers': vault_only,
        'storage_refs': storage_handlers,
        'ready_state': ready_state,
    }


def main() -> None:
    segs = build_init_segments()

    write(
        OUT / 'init-agent-database.ts',
        '''import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SQLite from 'expo-sqlite'
import { Platform } from 'react-native'
import { ensureExpoAgentDatabaseInstalled, verifyExpoAgentDatabaseIntegrity, type ExpoSqliteDatabase } from '@baishou/database/expo'
import { SessionManagerService, AssistantManagerService, SettingsManagerService, SummaryManagerService, SummaryGeneratorService, MissingSummaryDetector, SessionFileService, SessionSyncService, SummaryFileService, SummarySyncService } from '@baishou/core-mobile'
import { resolveSummaryTemplatesForGeneration, logger, type SummaryPromptLocale } from '@baishou/shared'
import { SessionRepository, AssistantRepository, SettingsRepository, UserProfileRepository, SummaryRepositoryImpl, SnapshotRepository, createSqlExecutorFromDrizzleDb } from '@baishou/database'
import { AgentSessionService, HybridSearchService } from '@baishou/ai'
import { agentDbRuntimeRef } from '../../services/mobile-agent-db-runtime-ref'
import { createMobileFileSystem } from '../../services/create-mobile-file-system'
import { setupMobileLocalFileReader } from '../../services/mobile-local-file-reader.service'
import { setupMobileImageCompressor } from '../../services/mobile-image-compressor.service'
import { setupMobileTtsRefAudioReader } from '../../services/mobile-tts-ref-audio.service'
import { MobileStoragePathService } from '../../services/path.service'
import { MobileAttachmentManagerService } from '../../services/mobile-attachment-manager.service'
import { createMobileSessionDiskPersistenceHooks } from '../../services/session-file-watcher.service'
import { RecoveryAwareSessionSyncService, RecoveryAwareSummarySyncService } from '../../services/recovery-aware-sync.services'
import { mobileAgentDbRecovery, MOBILE_AGENT_DB_NAME, rebuildMobileAgentDatabase } from '../../services/mobile-agent-db-recovery.service'
import { createVaultDiaryServiceProxy, EMPTY_DIARY_REPO_ADAPTER, EMPTY_DIARY_SEARCHER, initVaultLayer } from '../../services/mobile-vault-runtime.service'
import { FLUTTER_LEGACY_MIGRATED_SOURCE_KEY, PENDING_RESTORE_CLOUD_SYNC_CONFIG_KEY } from '@/src/constants/storage'
import { detectFlutterLegacyMigrationPending, type FlutterLegacyMigrationPending } from '../../services/mobile-legacy-migration.service'
import { getMobileInstallInstanceId } from '../../services/install-instance.service'
import { isExternalStorageRequiredError } from '../../services/storage-permission.service'
import { buildMobileSummaryAiClient } from '../../services/mobile-summary-ai-client'
import { createSharedContextBuilders } from './shared-context-builders'
import type { MobileBaishouInitContext } from './init-context'

export async function initAgentDatabase(ctx: MobileBaishouInitContext) {
  const { refs } = ctx
  const isMounted = ctx.isMounted
'''
        + segs['agent_db']
        + '\n  return { openAgentDatabase, fileSystem, pathService, settingsManager, attachmentManager, sessionRepo, assistantRepo, settingsRepo, summaryRepo, profileRepo, snapshotRepo, sessionManager, assistantManager, vaultService, vaultRuntimeDeps, diaryStack, diaryStackRef: refs.diaryStackRef, diaryServiceProxy, diarySearcher, summaryManager, summaryGenerator, missingSummaryDetector, summarySyncService, summaryFileService, buildSharedContext, buildSharedContextPreview, agentService, sqlExecutor, hsRepo, hybridSearchService, legacyRagReembedRequired, pendingFlutterLegacyMigration, legacyMigrationSourcePendingDeletion, storageReady, agentDbRebuiltAtStartup, drizzleDb, expoDb, summaryConfig, promptLocale, customTemplates, sessionFileService, assistantFileService, settingsFileService, summaryFileService, sessionSyncService, diaryRepoAdapter, migrationRuntimeRef: refs.migrationRuntimeRef, install, registry: undefined }\n}\n',
    )

    print('init-agent-database', len((OUT / 'init-agent-database.ts').read_text().splitlines()))


if __name__ == '__main__':
    main()
