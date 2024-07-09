import { serve, TLSOptions, type Server, spawn, type Subprocess } from "bun";

export type ProxyOptions = {
  hostname?: string;
  port?: number;
  tls?: TLSOptions;
  proxy_map: Map<string, string>;
};

export const proxy: {
  server: Server;
  setup: (_: ProxyOptions) => Promise<void>;
  teardown: () => Promise<void>;
} = {
  server: undefined,
  async setup({ hostname = "localhost", port = 7000, tls = undefined, proxy_map }: ProxyOptions) {
    const fetch_handler = async (request: Request) => {
      const requestUrl = new URL(request.url);
      let matched = false;
      proxy_map.forEach((host, proxyPath) => {
        if (requestUrl.pathname.startsWith(proxyPath)) {
          requestUrl.host = host;
          requestUrl.pathname = requestUrl.pathname.replace(new RegExp(`^${proxyPath}`), "");
          matched = true;
        }
      }, requestUrl);

      if (!matched) {
        return new Response("Not Found", { status: 404 });
      }

      const proxyRequest = new Request(requestUrl, request);
      proxyRequest.headers.set("X-Forwarded-Proto", tls ? "https" : "http");
      proxyRequest.headers.set("X-Forwarded-Host", hostname);
      //proxyRequest.headers.set("X-Forwarded-For", "8.8.8.8");
      proxyRequest.headers.set("Origin", this.server.url.origin);
      return fetch(proxyRequest);
    };

    this.server = serve({ fetch: fetch_handler, hostname, port, tls });
  },
  async teardown() {
    this.server.stop(true);
  },
};

export const test_project: {
  server: Subprocess<"ignore", "pipe", "inherit">;
  setup: (_?: { hostname?: string; port?: number }) => Promise<void>;
  teardown: () => Promise<void>;
} = {
  server: undefined,
  async setup({ hostname = "localhost", port = 7001 } = {}) {
    await spawn({
      cmd: ["bun", "install"],
      cwd: process.cwd() + "/test/project",
      stdout: null,
    }).exited;
    await spawn({
      cmd: ["bun", "x", "--bun", "vite", "build"],
      cwd: process.cwd() + "/test/project",
      stdout: null,
    }).exited;
    this.server = spawn({
      cmd: ["bun", "./build/index.js"],
      cwd: process.cwd() + "/test/project",
      env: {
        HOST: hostname,
        PORT: port.toString(),
      },
    });
    const decoder = new TextDecoder();
    for await (const chunk of this.server.stdout) {
      if (RegExp(`^Listening on ${hostname}:${port}`).test(decoder.decode(chunk))) {
        break;
      }
    }
  },
  async teardown() {
    this.server.kill();
    await Promise.all([
      spawn({
        cmd: ["rm", "-f", "bun.lockb"],
        cwd: process.cwd() + "/test/project",
      }),
      spawn({
        cmd: ["rm", "-rf", "build"],
        cwd: process.cwd() + "/test/project",
      }),
    ]);
  },
};
