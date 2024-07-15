import {
  env_prefix,
  Server,
  manifest,
  development,
  xff_depth,
  address_header,
  protocol_header,
  host_header,
  forwarded,
} from "./env";
import {
  fileURLToPath,
  type Server as BunServer,
  type ServeOptions,
  type WebSocketHandler as BunWebSocketHandler,
} from "bun";
import path from "path";
import { default as bunsirv, type NextHandler } from "./bunsirv";
import { existsSync } from "fs";
import type { Server as KitServer } from "@sveltejs/kit";
import { parse as parseForwarded } from "./forwarded";

const __dirname = path.dirname(fileURLToPath(new URL(import.meta.url)));
type WebSocketUpgradeHandler = (request: Request, server: BunServer) => Promise<boolean> | boolean;
type FetchHandler = ServeOptions["fetch"];
export type WebSocketHandler = BunWebSocketHandler & { upgrade?: WebSocketUpgradeHandler };
const server = new Server(manifest) as KitServer & {
  websocket: () => WebSocketHandler;
};
await server.init({ env: (Bun || process).env });

export default function (assets: boolean): {
  fetch: FetchHandler;
  websocket?: BunWebSocketHandler;
} {
  const handlers = [
    assets && serve(path.join(__dirname, "/client"), true),
    assets && serve(path.join(__dirname, "/prerendered")),
    ssr,
  ].filter(Boolean);
  const handler: FetchHandler = (request, server) => {
    const handle = (i: number) => {
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
    };
    return handle(0);
  };

  const defaultAcceptWebsocket: WebSocketUpgradeHandler = (request, server) => {
    if (development) {
      console.info("Upgrading websocket request on:", request.url);
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

function serve(path: string, client: boolean = false) {
  if (development) {
    console.info("serve(path:", path, ", client:", client, ")");
  }
  return (
    existsSync(path) &&
    bunsirv(path, {
      etag: true,
      gzip: true,
      brotli: true,
      setHeaders:
        client &&
        ((headers, pathname) => {
          if (pathname.startsWith(`/${manifest.appDir}/immutable/`)) {
            headers.set("cache-control", "public,max-age=31536000,immutable");
          }
        }),
    })
  );
}

function ssr(request: Request, _: NextHandler, bunServer: BunServer) {
  const clientIp = bunServer.requestIP(request)?.address;
  const url = new URL(request.url);
  let req = request;

  if (development) {
    console.info("ssr(", url.toString(), ",", clientIp, ")");
  }

  if (forwarded) {
    if (!request.headers.has("forwarded")) {
      throw new Error(
        `${env_prefix + "FORWARDED"} is set but request header "Forwarded" is empty.`,
      );
    }
    if (development) {
      console.info('Handling "Forwarded" header', request.headers.get("forwarded"));
    }
    const forwardedHeader = parseForwarded(request.headers.get("forwarded"));
    if (forwardedHeader["proto"]) {
      url.protocol = forwardedHeader["proto"] + ":";
    }
    if (forwardedHeader["host"]) {
      url.host = forwardedHeader["host"];
    }
  } else if (
    (host_header && url.host !== request.headers.get(host_header)) ||
    (protocol_header && url.protocol !== request.headers.get(protocol_header) + ":")
  ) {
    if (development) {
      console.info("Handling proxy headers:", host_header, protocol_header);
    }
    if (!(request.headers.get(host_header) && request.headers.get(protocol_header))) {
      throw new Error(
        `${env_prefix + "HOST_HEADER"} and ${env_prefix + "PROTOCOL_HEADER"} are set but request headers are empty.`,
      );
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
        env_prefix + "ADDRESS_HEADER"
      }=${address_header} but is absent from request`,
    );
  }

  return server.respond(req, {
    getClientAddress() {
      if (development) {
        console.info("getClientAddress(", req.url, ")");
      }
      if (forwarded) {
        const forwardedHeader = parseForwarded(request.headers.get("forwarded"));
        if (forwardedHeader["for"]) {
          return forwardedHeader["for"];
        }
      } else if (address_header) {
        const value = /** @type {string} */ req.headers.get(address_header) || "";

        if (address_header === "x-forwarded-for") {
          const addresses = value.split(",");

          if (xff_depth < 1) {
            throw new Error(`${env_prefix + "XFF_DEPTH"} must be a positive integer`);
          }

          if (xff_depth > addresses.length) {
            throw new Error(
              `${env_prefix + "XFF_DEPTH"} is ${xff_depth}, but only found ${
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
    console.info("Rewriting request.url", request.url, "->", url.toString());
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
    integrity: request.integrity,
  });
}
