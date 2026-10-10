import { describe, it, expect, beforeEach } from 'vitest';
import { configureIpBans, getIpBansConfig, resetIpBansConfig } from '../../src/ip-bans/config.js';

describe('ip-bans config', () => {
	beforeEach(() => {
		resetIpBansConfig();
	});

	describe('getIpBansConfig defaults', () => {
		it('returns default securityDir based on cwd', () => {
			expect(getIpBansConfig().securityDir).toContain('content/security');
		});

		it('returns default banFileName', () => {
			expect(getIpBansConfig().banFileName).toBe('ip-bans.json');
		});

		it('returns noop logger', () => {
			const logger = getIpBansConfig().getLogger();
			expect(logger.info).toBeTypeOf('function');
			expect(logger.warn).toBeTypeOf('function');
			expect(logger.error).toBeTypeOf('function');
			expect(logger.debug).toBeTypeOf('function');
			
			logger.info('test');
			logger.error('test');
		});

		it('returns generateId that produces UUIDs', () => {
			const id = getIpBansConfig().generateId();
			expect(id).toBeTypeOf('string');
			expect(id.length).toBeGreaterThan(0);
		});
	});

	describe('configureIpBans', () => {
		it('sets securityDir', () => {
			configureIpBans({ securityDir: '/tmp/sec' });
			expect(getIpBansConfig().securityDir).toBe('/tmp/sec');
		});

		it('sets banFileName', () => {
			configureIpBans({ banFileName: 'bans.json' });
			expect(getIpBansConfig().banFileName).toBe('bans.json');
		});

		it('sets custom logger', () => {
			const custom = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
			configureIpBans({ getLogger: () => custom });
			expect(getIpBansConfig().getLogger()).toBe(custom);
		});

		it('sets custom generateId', () => {
			configureIpBans({ generateId: () => 'fixed-id' });
			expect(getIpBansConfig().generateId()).toBe('fixed-id');
		});

		it('merges with existing config', () => {
			configureIpBans({ securityDir: '/a' });
			configureIpBans({ banFileName: 'b.json' });
			expect(getIpBansConfig().securityDir).toBe('/a');
			expect(getIpBansConfig().banFileName).toBe('b.json');
		});
	});

	describe('resetIpBansConfig', () => {
		it('resets to defaults', () => {
			configureIpBans({ securityDir: '/custom', banFileName: 'custom.json' });
			resetIpBansConfig();
			expect(getIpBansConfig().banFileName).toBe('ip-bans.json');
			expect(getIpBansConfig().securityDir).toContain('content/security');
		});
	});
});
