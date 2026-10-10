# Changelog

## 1.0.0 (2026-10-10)

Major release: the toolchain and peer stack change (RU1/RU10), and the package
absorbs `@tummycrypt/tinyland-ip-bans` as a new subpath export (RU2/RU7).
The runtime API of the root entry is unchanged.

### Breaking

- Toolchain: TypeScript 7.0.2 (native compiler, exact pin), vitest 5.0.3
  (exact pin), `@types/node` ^22, `@fast-check/vitest` ^0.5. Bazel uses
  aspect_rules_ts 3.10.1 with the `typescript` extension at 7.0.2.
  `tsconfig.json` now lists `"types": ["node"]`, because TypeScript 7 no
  longer includes every `@types/*` package by default.
- Distribution is Bazel only (RU6/RU8). The package is `private`, the
  `publishConfig`, `prepublishOnly` script and `publish.yml` workflow are
  removed, and CI never publishes. Consume it through
  `bazel_dep(name = "tummycrypt_tinyland_security", version = "1.0.0")` from
  the xoxd-ai bazel-registry. Nothing is published to npmjs or GitHub
  Packages; the existing 0.x versions there stay as they are.
- The unused `tummycrypt_tinyland_auth` bazel_dep, the
  `@tummycrypt/tinyland-auth` devDependency and its optional peer are
  removed. No source file imports tinyland-auth (it appears only in
  comments), so a consumer no longer has to align its own tinyland-auth
  compatibility level with this module.

### Added

- `@tummycrypt/tinyland-security/ip-bans`: the flat-file IP ban store
  formerly published as `@tummycrypt/tinyland-ip-bans` 0.2.x (registry
  module `tummycrypt_tinyland_ip_bans`, now retired). The API is unchanged:
  `configureIpBans`, `getIpBansConfig`, `resetIpBansConfig`, `isIpBanned`,
  `addIpBan`, `removeIpBan`, `deactivateIpBan`, `getActiveBans`,
  `cleanupExpiredBans` and the `IpBan`, `AddIpBanOptions`, `IpBansLogger`
  and `IpBansConfig` types. The source is byte-identical to
  xoxd-ai/tinyland-ip-bans 54153c4 apart from a provenance comment.
  It is a subpath, not part of the root entry, because the root already
  exports an older ban store with the same function names
  (`isIpBanned`, `addIpBan`, ..., configured with `configureIpBanStore`).
  The two stores keep separate configuration; pick one per application.

### Migration

1. Re-pin: `bazel_dep(name = "tummycrypt_tinyland_security", version = "1.0.0")`
   and pin the registry commit that carries it. Move the consumer to the RU1
   stack (TypeScript 7.0.2 exact) in the same change.
2. Replace `@tummycrypt/tinyland-ip-bans` imports (and `vi.mock` targets)
   with `@tummycrypt/tinyland-security/ip-bans`, then drop the
   `tummycrypt_tinyland_ip_bans` bazel_dep, its `npm_link_package` and any
   package.json entry for it.
3. Runtime behaviour of the ip-bans subpath is identical, including the
   default store path (`content/security/ip-bans.json` under
   `process.cwd()`), the no-op logger and `crypto.randomUUID()` ids until
   `configureIpBans` is called.
4. Remove any `@tummycrypt/tinyland-security` npm dependency or GitHub
   Packages registry setting; link the Bazel module instead.
