// @ts-ignore
import { Server } from "SERVER";
// @ts-ignore
import { manifest } from "MANIFEST";
import { build_options, env } from "./env.js";
import {
  fileURLToPath,
  type Server as BunServer,
  type ServeOptions,
  type WebSocketHandler
} from "bun";
import path from "path";
import sirv from "bunsirv";
import { existsSync } from "fs";
import type { Server as KitServer } from "@sveltejs/kit";
import type { NextHandler } from "bunsirv";

const __dirname = path.dirname(fileURLToPath(new URL(import.meta.url)));
type WebSocketUpgradeHandler = (request: Request, server: BunServer) => Promise<boolean> | boolean
type FetchHandler = ServeOptions['fetch']
const server = new Server(manifest) as KitServer & { websocket: () => WebSocketHandler & { upgrade?: WebSocketUpgradeHandler} };
await server.init({ env: (Bun || process).env });

const xff_depth: number = parseInt(env("XFF_DEPTH", build_options.xff_depth ?? 0));
const origin : string | undefined = env("ORIGIN", undefined);
const address_header : string = env("ADDRESS_HEADER", "").toLowerCase();
const protocol_header : string = env("PROTOCOL_HEADER", "").toLowerCase();
const host_header : string = env("HOST_HEADER", "host").toLowerCase();
const development : boolean = !!env("SERVERDEV", build_options.development ?? false);

export default function (assets: boolean): { fetch: FetchHandler, websocket?: WebSocketHandler } {
  const handlers = [
    assets && serve(path.join(__dirname, "/client"), true),
    assets && serve(path.join(__dirname, "/prerendered")),
    ssr,
  ].filter(Boolean);
  const handler: FetchHandler = (request, server) => {
    const handle = (i: number) => {
      res.end()
      return handlers[i](
        request,
        () => {
          if (i < handlers.length) {
            return handle(i + 1);
          } else {
            return new Response("404", { status: 404 });
          }
        },
        server,
      );
    }
    return handle(0);
  }

  const defaultAcceptWebsocket: WebSocketUpgradeHandler = (request, server) => {
    if (development) {
      console.log("defaultAcceptWebsocket(", request.url, ")");
    }
    return server.upgrade(request);
  };

  try {
    const handleWebsocket = server.websocket();
    if (handleWebsocket) {
      return {
        fetch: async (req, srv) => {
          if (
            req.headers.get("connection")?.toLowerCase().includes("upgrade") &&
            req.headers.get("upgrade")?.toLowerCase() === "websocket"
          ) {
            const upgrade = (handleWebsocket.upgrade ?? defaultAcceptWebsocket)(req, srv);
            if (upgrade instanceof Promise ? await upgrade : upgrade) {
              return;
            }
          }
          return handler.bind(srv)(req, srv);
        },
        websocket: handleWebsocket,
      };
    }
  } catch (e) {
    console.warn("Fail: websocket handler error:", e);
  }
  return {
    fetch: handler,
  };
}

function serve(path: string, client:boolean = false) {
  if (development) {
    console.log("serve(path:", path, ", client:", client, ")");
  }
  return existsSync(path) &&
    sirv(path, {
      etag: true,
      gzip: true,
      brotli: true,
      setHeaders:
        client &&
        (({ setHeader }, pathname) => {
          if (pathname.startsWith(`/${manifest.appDir}/immutable/`)) {
            setHeader("cache-control", "public,max-age=31536000,immutable");
          }
        }),
    })

}

function ssr(request: Request, _: NextHandler, bunServer: BunServer) {
  const clientIp = bunServer.requestIP(request)?.address;
  const url = new URL(request.url);
  let req = request;

  if (development) {
    console.log("ssr(", url.toString(), ",", clientIp, ")");
  }

  if (origin) {
    if (development) {
      console.log("Handling origin header");
    }
    const new_url = new URL(origin);
    new_url.pathname = url.pathname;
    new_url.search = url.search;
    new_url.hash = url.hash;
    req = clone_req(new_url, request);
  } else if (
    (host_header && url.host !== request.headers.get(host_header)) ||
    (protocol_header && url.protocol !== request.headers.get(protocol_header) + ":")
  ) {
    if (development) {
      console.log("Handling x-forwarded-* header:", host_header, protocol_header);
    }
    if (host_header) {
      url.host = request.headers.get(host_header);
    }
    if (protocol_header) {
      url.protocol = request.headers.get(protocol_header) + ":";
    }
    req = clone_req(url, request);
  }

  if (address_header && !request.headers.has(address_header)) {
    throw new Error(
      `Address header was specified with ${
        ENV_PREFIX + "ADDRESS_HEADER"
      }=${address_header} but is absent from request`,
    );
  }

  return server.respond(req, {
    getClientAddress() {
      if (development) {
        console.log("getClientAddress(", req.url, ")");
      }
      if (address_header) {
        const value = /** @type {string} */ (req.headers.get(address_header)) || "";

        if (address_header === "x-forwarded-for") {
          const addresses = value.split(",");

          if (xff_depth < 0) {
            throw new Error(`${ENV_PREFIX + "XFF_DEPTH"} must be a positive integer`);
          }

          if (xff_depth > addresses.length) {
            throw new Error(
              `${ENV_PREFIX + "XFF_DEPTH"} is ${xff_depth}, but only found ${
                addresses.length
              } addresses`,
            );
          }
          return addresses[addresses.length - xff_depth].trim();
        }

        return value;
      }
      if (!clientIp) {
        throw new Error("Unable to determine client IP.");
      }
      return clientIp;
    },
    platform: {
      get isBun() {
        return true;
      },
      get bunServer() {
        return bunServer;
      },
      get originalRequest() {
        return request;
      },
    },
  });
}

function clone_req(url: string | URL, request: Request) {
  if (development) {
    console.log("Rewriting request.url", request.url, "->", url.toString());
  }
  return new Request(url, {
    headers: request.headers,
    method: request.method,
    body: request.body,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    mode: request.mode,
    credentials: request.credentials,
    cache: request.cache,
    redirect: request.redirect,
    integrity: request.integrity
  });
}
