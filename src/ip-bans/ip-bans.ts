import { promises as fs } from 'fs';
import path from 'path';
import { getIpBansConfig } from './config.js';
import type { IpBan, AddIpBanOptions } from './types.js';

function getBanFilePath(): string {
  const cfg = getIpBansConfig();
  return path.join(cfg.securityDir, cfg.banFileName);
}


async function ensureFile(): Promise<void> {
  const cfg = getIpBansConfig();
  const filePath = getBanFilePath();
  try {
    await fs.mkdir(cfg.securityDir, { recursive: true });
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, '[]', 'utf8');
  }
}


async function readBans(): Promise<IpBan[]> {
  await ensureFile();
  const cfg = getIpBansConfig();
  const logger = cfg.getLogger();
  const filePath = getBanFilePath();
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const parsed: unknown = JSON.parse(content);

    
    if (!Array.isArray(parsed)) {
      logger.warn('IP bans file contains invalid data (not an array), resetting to empty array');
      await fs.writeFile(filePath, '[]', 'utf8');
      return [];
    }

    return parsed as IpBan[];
  } catch (error) {
    logger.error('Error reading IP bans file, resetting to empty array:', {
      error: error instanceof Error ? error.message : String(error),
    });
    await fs.writeFile(filePath, '[]', 'utf8');
    return [];
  }
}


async function writeBans(bans: IpBan[]): Promise<void> {
  const filePath = getBanFilePath();
  await fs.writeFile(filePath, JSON.stringify(bans, null, 2), 'utf8');
}


export async function isIpBanned(ipAddress: string): Promise<boolean> {
  const cfg = getIpBansConfig();
  const logger = cfg.getLogger();
  try {
    const bans = await readBans();
    const now = new Date();

    return bans.some((ban) => {
      if (!ban.is_active) return false;

      
      if (ban.expires_at && new Date(ban.expires_at) < now) {
        return false;
      }

      
      if (ban.ip_address === ipAddress) {
        return true;
      }

      
      if (ban.ip_range_start && ban.ip_range_end) {
        return ipAddress >= ban.ip_range_start && ipAddress <= ban.ip_range_end;
      }

      return false;
    });
  } catch (error) {
    logger.error('Error checking IP ban:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}


export async function addIpBan(
  ipAddress: string,
  options?: AddIpBanOptions
): Promise<void> {
  const cfg = getIpBansConfig();
  const bans = await readBans();

  const newBan: IpBan = {
    id: cfg.generateId(),
    ip_address: ipAddress,
    ip_range_start: options?.ipRangeStart,
    ip_range_end: options?.ipRangeEnd,
    reason: options?.reason,
    banned_by: options?.bannedBy,
    banned_at: new Date().toISOString(),
    expires_at: options?.expiresAt?.toISOString(),
    is_active: true,
  };

  bans.push(newBan);
  await writeBans(bans);
}


export async function removeIpBan(ipAddress: string): Promise<void> {
  const bans = await readBans();
  const filteredBans = bans.filter((ban) => ban.ip_address !== ipAddress);
  await writeBans(filteredBans);
}


export async function deactivateIpBan(ipAddress: string): Promise<void> {
  const bans = await readBans();
  const ban = bans.find((b) => b.ip_address === ipAddress);
  if (ban) {
    ban.is_active = false;
    await writeBans(bans);
  }
}


export async function getActiveBans(): Promise<IpBan[]> {
  const bans = await readBans();
  const now = new Date();

  return bans.filter((ban) => {
    if (!ban.is_active) return false;
    if (ban.expires_at && new Date(ban.expires_at) < now) return false;
    return true;
  });
}


export async function cleanupExpiredBans(): Promise<number> {
  const bans = await readBans();
  const now = new Date();

  const activeBans = bans.filter((ban) => {
    if (!ban.expires_at) return true;
    return new Date(ban.expires_at) >= now;
  });

  const removedCount = bans.length - activeBans.length;
  if (removedCount > 0) {
    await writeBans(activeBans);
  }

  return removedCount;
}
