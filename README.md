# @jonasbuerger/svelte-adapter-bun

[![Release](https://github.com/JonasBuerger/svelte-adapter-bun/actions/workflows/release.yml/badge.svg)](https://github.com/JonasBuerger/svelte-adapter-bun/actions/workflows/release.yml)

[Adapter](https://kit.svelte.dev/docs/adapters) for SvelteKit apps that generates a standalone [Bun](https://github.com/oven-sh/bun) server.

## Usage

Install with `bun add -d @jonasbuerger/svelte-adapter-bun`, then add the adapter to your `svelte.config.js`:

```js
// svelte.config.js
import adapter from "@jonasbuerger/svelte-adapter-bun";

export default {
  kit: {
    adapter: adapter(),
  },
};
```

After building the server `vite build`, use `vite preview` to start the server.

During development, you can use `vite dev`, for hot-reloading:

## Options

The adapter can be configured with various options:

```js
// svelte.config.js
import adapter from "@jonasbuerger/svelte-adapter-bun";
export default {
  kit: {
    adapter: adapter({
      //build options
      out: "build",
      // precompress: true,
      precompress: {
        brotli: true,
        gzip: true,
        files: ["htm", "html"],
      },
      transpileBun: false,
      //server/adapter options
      assets: true,
      envPrefix: "MY_CUSTOM_",
      development: true, //SERVERDEV
      host: "localhost", //HOST
      port: 3000, //PORT
      tls: {
        key: "server.key",
        cert: "server.crt",
      },
      protocol_header: "X-Forwarded-Proto", //PROTOCOL_HEADER
      host_header: "X-Forwarded-Host", //HOST_HEADER
      address_header: "X-Forwarded-For", //ADDRESS_HEADER
      xff_depth: 1, //XFF_DEPTH
    }),
  },
};
```

### out

Default: `"build"`

The directory to build the server to — i.e. `bun run build/index.js` would start the server locally after it has been created.

### precompress

Default: `false`

Type: `boolean | CompressOptions`

Enables precompressing using gzip and brotli for assets and prerendered pages.

#### precompress.brotli

Default: `false`

Enable brotli precompressing.

#### precompress.gzip

Default: `false`

Enable gzip precompressing.

#### precompress.files

Default: `['html','js','json','css','svg','xml','wasm']`

File extensions to compress.

### transpileBun

Default: `true`

Runs buns [transpiler](https://bun.sh/docs/api/transpiler#transformsync) during the server build

### assets

Default: `true`

Serve static assets.

- [x] Supports [HTTP range requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests)

### envPrefix

May be used to deconflict/disambiguate adapter settings with environment variables you don't control:

```js
// svelte.config.js
export default {
  kit: {
    adapter: adapter({
      envPrefix: "MY_CUSTOM_",
    }),
  },
};
```

```dotenv
#.env
MY_CUSTOM_HOST="127.0.0.1"
MY_CUSTOM_PORT=4000
MY_CUSTOM_ORIGIN="https://my.site"
```

### development

Default: `false`

Environment variable: `SERVERDEV`

Enables bun's error page and additional logging.

### host

Default: `0.0.0.0`

Environment variable: `HOST`

Sets the hostname on which the server accepts connections.

### port

Default: `3000`

Environment variable: `PORT`

Sets the port on which the server accepts connections.

### tls

Default: `[]`

Type: `TLSOptions | TLSOptions[]`

Sets the tls options for the bun server.

### tls.cert

Default: `""`

Type: `string | string[]`

The path to your certificate file relative to the project root.

### tls.key

Default: `""`

Type: `string | string[]`

The path to your key file relative to the project root.

### forwarded

Default: `false`

Environment variable: `FORWARDED`

Set to true if your proxy uses the [Forwarded](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Forwarded) Header.

### protocol_header

Default: `""`

Environment variable: `PROTOCOL_HEADER`

Header set by proxy, to determine the original protocol.

### host_header

Default: `""`

Environment variable: `HOST_HEADER`

Header set by proxy, to determine the original hostname.

From [SvelteKit Dokumentation](https://kit.svelte.dev/docs/adapter-node#environment-variables-origin-protocolheader-hostheader-and-port-header):

> [`x-forwarded-proto`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-Proto) and [`x-forwarded-host`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-Host) are de facto standard headers that forward the original protocol and host if you're using a reverse proxy (think load balancers and CDNs). You should only set these variables if your server is behind a trusted reverse proxy; otherwise, it'd be possible for clients to spoof these headers.

### address_header

Default: `""`

Environment variable: `ADDRESS_HEADER`

Header for determining `event.clientAddress` behind proxies.

The [RequestEvent](https://kit.svelte.dev/docs/types#additional-types-requestevent) object passed to hooks and endpoints includes an `event.clientAddress` property representing the client's IP address.

### xff_depth

Default: `0`

The count of trusted proxies before your server, used in conjunction with [address_header](#address_header).

## :spider_web: WebSocket Server

https://bun.sh/docs/api/websockets

```js
// hooks.server.js, hooks.server.ts

/** @type {import("@jonasbuerger/svelte-adapter-bun").WebSocketHandler} */
export const handleWebsocket = {
  open(ws) {
    console.log("WebSocket opened");
    ws.send("Hello from Server");
  },
  /**
   * @param {Request} request
   * @param {import('bun').Server} server
   */
  upgrade(request, server) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/ws")) {
      return server.upgrade(request);
    }
  },
};
```

## :desktop_computer: Environment variables

Some server options can also be configured via environment variables.
They are documented with those settings and take precedence over the settings in `svelte.config.js`

If [envPrefix](#envPrefix) is set, only variables starting with the prefix are used.
If an unexpected environment variable is found, an Error will be thrown.

> Bun [automatically reads configuration](https://bun.sh/docs/runtime/env) from `.env.local`, `.env.development`, `.env.production` and `.env`

## License

[MIT](LICENSE) © [Volodymyr Palamar](https://github.com/gornostay25)
