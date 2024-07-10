import { serve, spawn } from "bun";
import type { Subprocess, TLSOptions, Server } from "bun";
import { mkdir, cp, rm } from "node:fs/promises";

export type ProxyOptions = {
  hostname?: string;
  port?: number;
  tls?: TLSOptions;
  proxy_map: Map<string, string>;
};
const CWD = process.cwd();
function newRandomId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map(byte => byte.toString(16))
    .join("");
}

export function getProxy(): {
  server: Server;
  setup: (_: ProxyOptions) => Promise<void>;
  teardown: () => Promise<void>;
} {
  return {
    server: undefined,
    async setup({ hostname = "localhost", port = 7000, tls = undefined, proxy_map }: ProxyOptions) {
      if (this.server) {
        throw new Error("Server already running");
      }
      const fetch_handler = async (request: Request) => {
        const requestUrl = new URL(request.url);
        let matched = false;
        proxy_map.forEach((host, proxyPath) => {
          if (requestUrl.pathname.startsWith(proxyPath)) {
            requestUrl.protocol = proxyPath.startsWith("https") ? "https:" : "http:";
            requestUrl.host = host;
            requestUrl.pathname = requestUrl.pathname.replace(new RegExp(`^${proxyPath}`), "");
            matched = true;
          }
        }, requestUrl);

        if (!matched) {
          return new Response("Not Found", { status: 404 });
        }

        if ((!tls && port != 80) || (tls && port != 443)) {
          hostname += ":" + port;
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
      this.server = undefined;
    },
  };
}

export function getTestProject(): {
  server: Subprocess<"ignore", "pipe", "inherit">;
  projectDir: string;
  setup: (_?: {
    hostname?: string;
    port?: number;
    protocol_header?: string;
    host_header?: string;
    xff_depth?: number;
  }) => Promise<void>;
  teardown: () => Promise<void>;
} {
  return {
    server: undefined,
    projectDir: undefined,
    async setup({
      hostname = "localhost",
      port = 7000,
      protocol_header = "X-Forwarded-Proto",
      host_header = "X-Forwarded-Host",
      xff_depth = 0,
    } = {}) {
      if (this.server) {
        throw new Error("Server already running");
      }
      this.projectDir = `${CWD}/test/project-${newRandomId()}`;
      await cp(`${CWD}/test/project`, this.projectDir, { recursive: true });
      await spawn({
        cmd: ["bun", "install"],
        cwd: this.projectDir,
        stdout: null,
      }).exited;
      await spawn({
        cmd: ["bun", "x", "--bun", "vite", "build"],
        cwd: this.projectDir,
        stdout: null,
      }).exited;
      this.server = spawn({
        cmd: ["bun", "./build/index.js"],
        cwd: this.projectDir,
        env: {
          HOST: hostname,
          PORT: port.toString(),
          HOST_HEADER: host_header,
          PROTOCOL_HEADER: protocol_header,
          XFF_DEPTH: xff_depth.toString(),
          SERVERDEV: "1",
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
      await rm(this.projectDir, { force: true, recursive: true });
      this.server = undefined;
      this.projectDir = undefined;
    },
  };
}

export function getCerts(): {
  tls: TLSOptions;
  certDir: string;
  setup: () => Promise<void>;
  teardown: () => Promise<void>;
} {
  return {
    tls: undefined,
    certDir: undefined,
    async setup() {
      if (this.tls) {
        throw new Error("TLS certificates are already setup");
      }
      this.tempDir = `${CWD}/test/certs-${newRandomId()}`;
      await mkdir(this.tempDir);
      await spawn({
        cmd: [
          "openssl",
          "genrsa",
          "-aes256",
          "-passout",
          "pass:verysecretpass",
          "-out",
          "server.pass.key",
          "4096",
        ],
        cwd: this.tempDir,
        stdout: null,
      }).exited;
      await spawn({
        cmd: [
          "openssl",
          "rsa",
          "-passin",
          "pass:verysecretpass",
          "-in",
          "server.pass.key",
          "-out",
          "server.key",
        ],
        cwd: this.tempDir,
        stdout: null,
      }).exited;
      await rm(`${this.tempDir}/server.pass.key`);
      await spawn({
        cmd: ["openssl", "req", "-new", "-batch", "-key", "server.key", "-out", "server.csr"],
        cwd: this.tempDir,
        stdout: null,
      }).exited;
      await spawn({
        cmd: [
          "openssl",
          "x509",
          "-req",
          "-sha256",
          "-days",
          "1",
          "-in",
          "server.csr",
          "-signkey",
          "server.key",
          "-out",
          "server.crt",
        ],
        cwd: this.tempDir,
        stdout: null,
      }).exited;
      this.tls = {
        key: Bun.file(`${this.tempDir}/server.key`),
        cert: Bun.file(`${this.tempDir}/server.crt`),
      };
    },
    async teardown() {
      await rm(this.tempDir, { force: true, recursive: true });
      this.tls = undefined;
      this.certDir = undefined;
    },
  };
}
