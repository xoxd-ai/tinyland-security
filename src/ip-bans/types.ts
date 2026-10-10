export interface IpBan {
  id: string;
  ip_address: string;
  ip_range_start?: string;
  ip_range_end?: string;
  reason?: string;
  banned_by?: string;
  banned_at: string;
  expires_at?: string;
  is_active: boolean;
}

export interface AddIpBanOptions {
  reason?: string;
  bannedBy?: string;
  expiresAt?: Date;
  ipRangeStart?: string;
  ipRangeEnd?: string;
}
