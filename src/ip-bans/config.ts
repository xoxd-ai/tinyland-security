export interface IpBansLogger {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
  debug: (msg: string, meta?: Record<string, unknown>) => void;
}

export interface IpBansConfig {
  
  securityDir?: string;
  
  banFileName?: string;
  
  getLogger?: () => IpBansLogger;
  
  generateId?: () => string;
}

const noopLogger: IpBansLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

let config: IpBansConfig = {};

export function configureIpBans(c: IpBansConfig): void {
  config = { ...config, ...c };
}

export function getIpBansConfig(): Required<IpBansConfig> {
  return {
    securityDir:
      config.securityDir ??
      (typeof process !== 'undefined'
        ? `${process.cwd()}/content/security`
        : '/tmp/security'),
    banFileName: config.banFileName ?? 'ip-bans.json',
    getLogger: config.getLogger ?? (() => noopLogger),
    generateId: config.generateId ?? (() => crypto.randomUUID()),
  };
}

export function resetIpBansConfig(): void {
  config = {};
}
