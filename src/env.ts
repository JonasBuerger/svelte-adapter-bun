// @ts-ignore
export { Server } from "__SERVER";
// @ts-ignore
export { manifest } from "__MANIFEST";

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
export const build_options = __BUILD_OPTIONS as BuildOptions;
// @ts-ignore
export const env_prefix: string = __ENV_PREFIX;
export const hostname: string = env("HOST", "0.0.0.0");
export const port: number = parseInt(env("PORT", 3000));
export const origin: string | undefined = env("ORIGIN", undefined);
export const xff_depth: number = parseInt(env("XFF_DEPTH", build_options.xff_depth ?? 0));
export const address_header: string = env("ADDRESS_HEADER", "").toLowerCase();
export const protocol_header: string = env("PROTOCOL_HEADER", "").toLowerCase();
export const host_header: string = env("HOST_HEADER", "host").toLowerCase();
export const development: boolean = !!env("SERVERDEV", build_options.development ?? false);

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

function env(name: string, fallback: any): any {
  const prefixed = env_prefix + name;

  return prefixed in Bun.env ? Bun.env[prefixed] : fallback;
}
