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
export const env_prefix: string = "__ENV_PREFIX";

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

export function env(name: string, fallback: any): any {
  const prefixed = env_prefix + name;

  return prefixed in Bun.env ? Bun.env[prefixed] : fallback;
}
