// @ts-ignore
export { Server } from "__SERVER";
// @ts-ignore
export { manifest } from "__MANIFEST";
import type { AdapterOptions, TLSOptions } from "..";
import type { BunFile, TLSOptions as BunTLSOptions } from "bun";

function env(name: string, fallback: any): any {
  const prefixed = env_prefix + name;

  return prefixed in Bun.env ? Bun.env[prefixed] : fallback;
}
function makeBunFiles(paths: string[] | string | undefined): BunFile[] | BunFile | undefined {
  if (paths !== undefined && paths.length > 0) {
    return Array.isArray(paths) ? paths.map(path => Bun.file(path)) : Bun.file(paths);
  }
}
function parseTLSOption(option: TLSOptions): BunTLSOptions {
  return {
    ...option,
    ca: makeBunFiles(option.ca),
    cert: makeBunFiles(option.cert),
    key: makeBunFiles(option.key),
  } satisfies BunTLSOptions;
}
function parseTLSOptions(
  tls: TLSOptions | TLSOptions[],
): BunTLSOptions[] | BunTLSOptions | undefined {
  if (tls !== undefined) {
    return Array.isArray(tls) ? tls.map(parseTLSOption) : parseTLSOption(tls);
  }
}

const expected = new Set([
  "HOST",
  "PORT",
  "XFF_DEPTH",
  "ADDRESS_HEADER",
  "PROTOCOL_HEADER",
  "HOST_HEADER",
  "SERVERDEV",
]);

// @ts-ignore
const adapter_options = __ADAPTER_OPTIONS as AdapterOptions;
export const env_prefix: string = (adapter_options.envPrefix ?? "").toString();

if (env_prefix) {
  for (const name in Bun.env) {
    if (name.startsWith(env_prefix)) {
      const unprefixed = name.slice(env_prefix.length);
      if (!expected.has(unprefixed)) {
        throw new Error(
          `You should change envPrefix (${env_prefix}) to avoid conflicts with existing environment variables — unexpectedly saw ${name}`,
        );
      }
    }
  }
}

export const development: boolean = !!env("SERVERDEV", adapter_options.development ?? false);
export const hostname: string = env("HOST", adapter_options.host ?? "0.0.0.0").toString();
export const port: number = parseInt(env("PORT", adapter_options.port ?? 3000));
export const forwarded: boolean = !!env("FORWARDED", adapter_options.forwarded ?? false);
export const protocol_header: string = env(
  "PROTOCOL_HEADER",
  adapter_options.protocol_header ?? "",
).toLowerCase();
export const host_header: string = env(
  "HOST_HEADER",
  adapter_options.host_header ?? "host",
).toLowerCase();
export const address_header: string = env(
  "ADDRESS_HEADER",
  adapter_options.address_header ?? "",
).toLowerCase();
export const xff_depth: number = parseInt(env("XFF_DEPTH", adapter_options.xff_depth ?? 0));

export const assets = adapter_options.assets;

export const tls = parseTLSOptions(adapter_options.tls);
