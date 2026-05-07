import fs from 'fs-extra';
import path from 'path';
import os from 'os';

export interface Snapshot {
  id: string;
  timestamp: number;
  description: string;
  files: Record<string, string>;
}

const SNAPSHOT_DIR = '.aifeast/snapshots';
const MAX_SNAPSHOTS = 100;

export function getSnapshotsDir(): string {
  return path.join(os.homedir(), SNAPSHOT_DIR);
}

export function generateSnapshotId(): string {
  return `snap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function createSnapshot(cwd: string, description: string, modifiedFiles: string[]): Promise<Snapshot> {
  const snapshotDir = getSnapshotsDir();
  await fs.ensureDir(snapshotDir);
  
  const files: Record<string, string> = {};
  
  for (const file of modifiedFiles.slice(0, 50)) {
    try {
      const fullPath = path.join(cwd, file);
      if (await fs.pathExists(fullPath)) {
        files[file] = await fs.readFile(fullPath, 'utf-8');
      }
    } catch {}
  }
  
  const snapshot: Snapshot = {
    id: generateSnapshotId(),
    timestamp: Date.now(),
    description,
    files,
  };
  
  const snapshotFile = path.join(snapshotDir, `${snapshot.id}.json`);
  await fs.writeJson(snapshotFile, snapshot);
  
  await pruneOldSnapshots(snapshotDir);
  
  return snapshot;
}

async function pruneOldSnapshots(snapshotDir: string) {
  const entries = await fs.readdir(snapshotDir);
  const snapshots = entries
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();
  
  if (snapshots.length > MAX_SNAPSHOTS) {
    for (const old of snapshots.slice(MAX_SNAPSHOTS)) {
      await fs.remove(path.join(snapshotDir, old));
    }
  }
}

export async function listSnapshots(): Promise<Snapshot[]> {
  const snapshotDir = getSnapshotsDir();
  if (!await fs.pathExists(snapshotDir)) return [];
  
  const entries = await fs.readdir(snapshotDir);
  const snapshots: Snapshot[] = [];
  
  for (const entry of entries.filter(f => f.endsWith('.json')).sort().reverse().slice(0, 20)) {
    try {
      const snapshot = await fs.readJson(path.join(snapshotDir, entry));
      snapshots.push(snapshot);
    } catch {}
  }
  
  return snapshots;
}

export async function restoreSnapshot(snapshotId: string, cwd: string): Promise<{ success: boolean; restored: string[] }> {
  const snapshotDir = getSnapshotsDir();
  const snapshotFile = path.join(snapshotDir, `${snapshotId}.json`);
  
  if (!await fs.pathExists(snapshotFile)) {
    return { success: false, restored: [] };
  }
  
  const snapshot = await fs.readJson(snapshotFile);
  const restored: string[] = [];
  
  for (const [file, content] of Object.entries(snapshot.files)) {
    try {
      const fullPath = path.join(cwd, file);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, content as string);
      restored.push(file);
    } catch {}
  }
  
  return { success: true, restored };
}

export async function deleteSnapshot(snapshotId: string): Promise<boolean> {
  const snapshotDir = getSnapshotsDir();
  const snapshotFile = path.join(snapshotDir, `${snapshotId}.json`);
  
  if (!await fs.pathExists(snapshotFile)) return false;
  
  await fs.remove(snapshotFile);
  return true;
}