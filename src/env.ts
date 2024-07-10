// @ts-ignore
export { Server } from "__SERVER";
// @ts-ignore
export { manifest } from "__MANIFEST";
import type { AdapterOptions } from "..";

function env(name: string, fallback: any): any {
  const prefixed = env_prefix + name;

  return prefixed in Bun.env ? Bun.env[prefixed] : fallback;
}

const expected = new Set([
  "HOST",
  "PORT",
  "ORIGIN",
  "XFF_DEPTH",
  "ADDRESS_HEADER",
  "PROTOCOL_HEADER",
  "HOST_HEADER",
  "SERVERDEV",
]);

// @ts-ignore
export const adapter_options = __ADAPTER_OPTIONS as AdapterOptions;
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

export const hostname: string = env("HOST", adapter_options.host ?? "0.0.0.0").toString();
export const port: number = parseInt(env("PORT", adapter_options.port ?? 3000));
export const origin: string | undefined = env("ORIGIN", adapter_options.origin ?? undefined);
export const xff_depth: number = parseInt(env("XFF_DEPTH", adapter_options.xff_depth ?? 0));
export const address_header: string = env(
  "ADDRESS_HEADER",
  adapter_options.address_header ?? "",
).toLowerCase();
export const protocol_header: string = env(
  "PROTOCOL_HEADER",
  adapter_options.protocol_header ?? "",
).toLowerCase();
export const host_header: string = env(
  "HOST_HEADER",
  adapter_options.host_header ?? "host",
).toLowerCase();
export const development: boolean = !!env("SERVERDEV", adapter_options.development ?? false);
