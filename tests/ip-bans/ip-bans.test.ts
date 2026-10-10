import { describe, it, expect, beforeEach, vi } from 'vitest';
import { configureIpBans, resetIpBansConfig } from '../../src/ip-bans/config.js';

const mockMkdir = vi.fn().mockResolvedValue(undefined);
const mockAccess = vi.fn().mockResolvedValue(undefined);
const mockReadFile = vi.fn().mockResolvedValue('[]');
const mockWriteFile = vi.fn().mockResolvedValue(undefined);

vi.mock('fs', () => ({
	promises: {
		mkdir: (...args: unknown[]) => mockMkdir(...args),
		access: (...args: unknown[]) => mockAccess(...args),
		readFile: (...args: unknown[]) => mockReadFile(...args),
		writeFile: (...args: unknown[]) => mockWriteFile(...args),
	},
}));

import {
	isIpBanned,
	addIpBan,
	removeIpBan,
	deactivateIpBan,
	getActiveBans,
	cleanupExpiredBans,
} from '../../src/ip-bans/ip-bans.js';

describe('ip-bans', () => {
	beforeEach(() => {
		resetIpBansConfig();
		configureIpBans({
			securityDir: '/tmp/test-security',
			generateId: () => 'test-uuid',
		});
		mockMkdir.mockResolvedValue(undefined);
		mockAccess.mockResolvedValue(undefined);
		mockReadFile.mockResolvedValue('[]');
		mockWriteFile.mockResolvedValue(undefined);
		vi.clearAllMocks();
	});

	describe('isIpBanned', () => {
		it('returns false for empty bans list', async () => {
			expect(await isIpBanned('1.2.3.4')).toBe(false);
		});

		it('returns true for exact IP match', async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify([
					{ id: '1', ip_address: '1.2.3.4', is_active: true, banned_at: '2024-01-01' },
				]),
			);
			expect(await isIpBanned('1.2.3.4')).toBe(true);
		});

		it('returns false for non-matching IP', async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify([
					{ id: '1', ip_address: '5.6.7.8', is_active: true, banned_at: '2024-01-01' },
				]),
			);
			expect(await isIpBanned('1.2.3.4')).toBe(false);
		});

		it('returns false for inactive ban', async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify([
					{ id: '1', ip_address: '1.2.3.4', is_active: false, banned_at: '2024-01-01' },
				]),
			);
			expect(await isIpBanned('1.2.3.4')).toBe(false);
		});

		it('returns false for expired ban', async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify([
					{
						id: '1',
						ip_address: '1.2.3.4',
						is_active: true,
						banned_at: '2024-01-01',
						expires_at: '2020-01-01T00:00:00Z',
					},
				]),
			);
			expect(await isIpBanned('1.2.3.4')).toBe(false);
		});

		it('returns true for non-expired ban', async () => {
			const future = new Date(Date.now() + 86400000).toISOString();
			mockReadFile.mockResolvedValue(
				JSON.stringify([
					{
						id: '1',
						ip_address: '1.2.3.4',
						is_active: true,
						banned_at: '2024-01-01',
						expires_at: future,
					},
				]),
			);
			expect(await isIpBanned('1.2.3.4')).toBe(true);
		});

		it('returns true for IP within range (string comparison)', async () => {
			
			
			mockReadFile.mockResolvedValue(
				JSON.stringify([
					{
						id: '1',
						ip_address: '10.0.0.0',
						ip_range_start: '10.0.0.1',
						ip_range_end: '10.0.0.9',
						is_active: true,
						banned_at: '2024-01-01',
					},
				]),
			);
			expect(await isIpBanned('10.0.0.5')).toBe(true);
		});

		it('returns false for IP outside range', async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify([
					{
						id: '1',
						ip_address: '10.0.0.0',
						ip_range_start: '10.0.0.1',
						ip_range_end: '10.0.0.10',
						is_active: true,
						banned_at: '2024-01-01',
					},
				]),
			);
			expect(await isIpBanned('10.0.1.1')).toBe(false);
		});

		it('returns false on read error (fail-safe)', async () => {
			mockReadFile.mockRejectedValue(new Error('disk error'));
			
			mockAccess.mockRejectedValue(new Error('no access'));
			expect(await isIpBanned('1.2.3.4')).toBe(false);
		});
	});

	describe('addIpBan', () => {
		it('adds ban with default options', async () => {
			await addIpBan('1.2.3.4');
			expect(mockWriteFile).toHaveBeenCalled();
			const written = JSON.parse(mockWriteFile.mock.calls[0][1]);
			expect(written).toHaveLength(1);
			expect(written[0].ip_address).toBe('1.2.3.4');
			expect(written[0].is_active).toBe(true);
			expect(written[0].id).toBe('test-uuid');
		});

		it('adds ban with all options', async () => {
			await addIpBan('1.2.3.4', {
				reason: 'spam',
				bannedBy: 'admin',
				expiresAt: new Date('2030-01-01'),
				ipRangeStart: '1.2.3.0',
				ipRangeEnd: '1.2.3.255',
			});
			const written = JSON.parse(mockWriteFile.mock.calls[0][1]);
			expect(written[0].reason).toBe('spam');
			expect(written[0].banned_by).toBe('admin');
			expect(written[0].expires_at).toContain('2030');
			expect(written[0].ip_range_start).toBe('1.2.3.0');
			expect(written[0].ip_range_end).toBe('1.2.3.255');
		});

		it('preserves existing bans', async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify([{ id: 'old', ip_address: '5.5.5.5', is_active: true, banned_at: '2024-01-01' }]),
			);
			await addIpBan('1.2.3.4');
			const written = JSON.parse(mockWriteFile.mock.calls[0][1]);
			expect(written).toHaveLength(2);
		});

		it('sets banned_at timestamp', async () => {
			await addIpBan('1.2.3.4');
			const written = JSON.parse(mockWriteFile.mock.calls[0][1]);
			expect(written[0].banned_at).toBeTruthy();
			expect(new Date(written[0].banned_at).getTime()).toBeGreaterThan(0);
		});
	});

	describe('removeIpBan', () => {
		it('removes matching ban', async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify([
					{ id: '1', ip_address: '1.2.3.4', is_active: true, banned_at: '2024-01-01' },
					{ id: '2', ip_address: '5.6.7.8', is_active: true, banned_at: '2024-01-01' },
				]),
			);
			await removeIpBan('1.2.3.4');
			const written = JSON.parse(mockWriteFile.mock.calls[0][1]);
			expect(written).toHaveLength(1);
			expect(written[0].ip_address).toBe('5.6.7.8');
		});

		it('does not error for non-existent IP', async () => {
			await expect(removeIpBan('nonexistent')).resolves.not.toThrow();
		});
	});

	describe('deactivateIpBan', () => {
		it('sets is_active to false', async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify([
					{ id: '1', ip_address: '1.2.3.4', is_active: true, banned_at: '2024-01-01' },
				]),
			);
			await deactivateIpBan('1.2.3.4');
			const written = JSON.parse(mockWriteFile.mock.calls[0][1]);
			expect(written[0].is_active).toBe(false);
		});

		it('does nothing for non-existent IP', async () => {
			await deactivateIpBan('nonexistent');
			
			const writeCalls = mockWriteFile.mock.calls.filter(
				(c: unknown[]) => !(c[1] as string).startsWith('[]'),
			);
			expect(writeCalls).toHaveLength(0);
		});
	});

	describe('getActiveBans', () => {
		it('returns only active bans', async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify([
					{ id: '1', ip_address: '1.1.1.1', is_active: true, banned_at: '2024-01-01' },
					{ id: '2', ip_address: '2.2.2.2', is_active: false, banned_at: '2024-01-01' },
				]),
			);
			const result = await getActiveBans();
			expect(result).toHaveLength(1);
			expect(result[0].ip_address).toBe('1.1.1.1');
		});

		it('excludes expired bans', async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify([
					{
						id: '1',
						ip_address: '1.1.1.1',
						is_active: true,
						banned_at: '2024-01-01',
						expires_at: '2020-01-01T00:00:00Z',
					},
				]),
			);
			expect(await getActiveBans()).toHaveLength(0);
		});

		it('returns empty for no bans', async () => {
			expect(await getActiveBans()).toHaveLength(0);
		});
	});

	describe('cleanupExpiredBans', () => {
		it('removes expired bans and returns count', async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify([
					{
						id: '1',
						ip_address: '1.1.1.1',
						is_active: true,
						banned_at: '2024-01-01',
						expires_at: '2020-01-01T00:00:00Z',
					},
					{ id: '2', ip_address: '2.2.2.2', is_active: true, banned_at: '2024-01-01' },
				]),
			);
			const count = await cleanupExpiredBans();
			expect(count).toBe(1);
		});

		it('keeps non-expired bans', async () => {
			const future = new Date(Date.now() + 86400000).toISOString();
			mockReadFile.mockResolvedValue(
				JSON.stringify([
					{
						id: '1',
						ip_address: '1.1.1.1',
						is_active: true,
						banned_at: '2024-01-01',
						expires_at: future,
					},
				]),
			);
			expect(await cleanupExpiredBans()).toBe(0);
		});

		it('keeps bans without expiry', async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify([
					{ id: '1', ip_address: '1.1.1.1', is_active: true, banned_at: '2024-01-01' },
				]),
			);
			expect(await cleanupExpiredBans()).toBe(0);
		});

		it('returns 0 for empty list', async () => {
			expect(await cleanupExpiredBans()).toBe(0);
		});
	});

	describe('readBans validation', () => {
		it('handles non-array JSON by resetting', async () => {
			mockReadFile.mockResolvedValue('{"not": "array"}');
			const result = await getActiveBans();
			expect(result).toEqual([]);
		});

		it('handles corrupt JSON by resetting', async () => {
			mockReadFile.mockResolvedValue('not json at all');
			const result = await getActiveBans();
			expect(result).toEqual([]);
		});
	});

	describe('ensureFile', () => {
		it('creates directory and file if access fails', async () => {
			mockAccess.mockRejectedValue(new Error('ENOENT'));
			await getActiveBans(); 
			expect(mockMkdir).toHaveBeenCalledWith(expect.stringContaining('test-security'), {
				recursive: true,
			});
		});

		it('does not recreate existing file', async () => {
			mockAccess.mockResolvedValue(undefined);
			await getActiveBans();
			
			
		});
	});
});
