import { serve, TLSOptions, type Server } from "bun";

export type ProxyOptions = {
  hostname?: string;
  port?: number;
  tls?: TLSOptions;
  proxy_map: Map<string, string>;
};

export function proxy({
  hostname = "localhost",
  port = 7000,
  tls = undefined,
  proxy_map,
}: ProxyOptions): Server {
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
    proxyRequest.headers.set("Origin", server.url.origin);
    console.info("Proxy received:", request.url);
    console.info("Proxied to:", proxyRequest.url);
    return fetch(proxyRequest);
  };

  const server = serve({ fetch: fetch_handler, hostname, port, tls });

  return server;
}
