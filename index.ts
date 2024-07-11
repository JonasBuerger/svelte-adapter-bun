import {
  createReadStream,
  createWriteStream,
  existsSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "fs";
import { pipeline } from "stream";
import { Glob, type TLSOptions as BunTLSOptions } from "bun";
import { fileURLToPath } from "url";
import { promisify } from "util";
import zlib from "zlib";
import { type Adapter } from "@sveltejs/kit";
export type { WebSocketHandler } from "./src/handler";

export interface TLSOptions extends BunTLSOptions {
  ca?: string | Array<string> | undefined;
  cert?: string | Array<string> | undefined;
  key?: string | Array<string> | undefined;
}

export interface BuildOptions {
  /**
   * The directory to build the server to. It defaults to build — i.e. node build would start the server locally after it has been created.
   * @default "build"
   */
  out?: string;

  /**
   * Enables precompressing using gzip and brotli for assets and prerendered pages. It defaults to false.
   * @default false
   */
  precompress?: boolean | CompressOptions;

  /**
   * Transpile server side code with bun transpiler for optimization for bun.
   * @default true
   */
  transpileBun?: boolean;
}

export interface CompressOptions {
  /**
   * @default false
   */
  gzip?: boolean;

  /**
   * @default false
   */
  brotli?: boolean;

  /**
   * @default ["html","js","json","css","svg","xml","wasm"]
   */
  files?: string[];
}

export interface AdapterOptions {
  /**
   * Browse a static assets
   * @default true
   */
  assets?: boolean;

  /**
   * If you need to change the name of the environment variables used to configure the deployment (for example, to deconflict with environment variables you don't control), you can specify a prefix: envPrefix: 'MY_CUSTOM_';
   * @default ''
   */
  envPrefix?: string;

  /**
   * Render contextual errors? This enables bun's error page
   * Can be set via the SERVERDEV environment variable
   * @default false
   */
  development?: boolean;

  /**
   * The default value of HOST if environment variable is not set.
   * @default '0.0.0.0'
   */
  host?: string;

  /**
   * The default value of PORT if environment variable is not set.
   * @default '3000'
   */
  port?: number;

  /**
   * Settings for tls encryption.
   * @default []
   */
  tls?: TLSOptions | TLSOptions[];

  /**
   * The default value of PROTOCOL_HEADER if environment variable is not set.
   * @default ''
   */
  protocol_header?: string;

  /**
   * The default value of HOST_HEADER if environment variable is not set.
   * @default 'host'
   */
  host_header?: string;

  /**
   * The default value of ADDRESS_HEADER if environment variable is not set.
   * @default ''
   */
  address_header?: string;

  /**
   * The default value of XFF_DEPTH if environment variable is not set.
   * @default 0
   */
  xff_depth?: number;
}

const pipe = promisify(pipeline);
const files = fileURLToPath(new URL("./files", import.meta.url).href);

export default function ({
  out = "build",
  precompress = false,
  transpileBun = true,
  assets = true,
  envPrefix = "",
  development = false,
  xff_depth = 0,
  host = "0.0.0.0",
  port = 3000,
  address_header = "",
  protocol_header = "",
  host_header = "host",
  tls = [],
}: AdapterOptions & BuildOptions = {}): Adapter {
  return {
    name: "@jonasbuerger/svelte-adapter-bun",
    async adapt(builder) {
      builder.rimraf(out);
      builder.mkdirp(out);

      builder.log.minor("Copying assets");
      builder.writeClient(`${out}/client${builder.config.kit.paths.base}`);
      builder.writePrerendered(`${out}/prerendered${builder.config.kit.paths.base}`);

      if (precompress) {
        builder.log.minor("Compressing assets");
        await Promise.all([
          compress(`${out}/client`, precompress),
          compress(`${out}/prerendered`, precompress),
        ]);
      }

      builder.log.minor("Building server");
      builder.writeServer(`${out}/server`);

      writeFileSync(
        `${out}/manifest.js`,
        `export const manifest = ${builder.generateManifest({ relativePath: "./server" })};\n\n` +
          `export const prerendered = new Set(${JSON.stringify(builder.prerendered.paths)});\n`,
      );

      builder.log.minor("Patching server (websocket support)");
      patchServerWebsocketHandler(`${out}/server`);

      const pkg = JSON.parse(readFileSync("package.json", "utf8"));

      builder.copy(files, out, {
        replace: {
          __SERVER: "./server/index.js",
          __MANIFEST: "./manifest.js",
          __ADAPTER_OPTIONS: JSON.stringify({
            assets,
            envPrefix,
            development,
            xff_depth,
            host,
            port,
            address_header,
            protocol_header,
            host_header,
            tls,
          }),
        },
      });

      if (transpileBun) {
        const glob = new Glob("./server/**/*.js");
        const transpiler = new Bun.Transpiler({ loader: "js" });
        for await (const file of glob.scan({ cwd: out, absolute: true })) {
          const src = await Bun.file(file).text();
          if (src.startsWith("// @bun")) continue;
          await Bun.write(file, "// @bun\n" + transpiler.transformSync(src));
        }
      }

      let package_data = {
        name: "bun-sveltekit-app",
        version: "0.0.0",
        type: "module",
        private: true,
        main: "index.js",
        scripts: {
          start: "bun ./index.js",
        },
        dependencies: {},
      };

      try {
        pkg.name && (package_data.name = pkg.name);
        pkg.version && (package_data.version = pkg.version);
        pkg.dependencies &&
          (package_data.dependencies = {
            ...pkg.dependencies,
            ...package_data.dependencies,
          });
      } catch (error) {
        builder.log.warn(`Parse package.json error: ${error.message}`);
      }

      writeFileSync(`${out}/package.json`, JSON.stringify(package_data, null, "\t"));

      builder.log.success("Start server with: bun ./build/index.js");
    },
  };
}

async function compress(directory: string, options: CompressOptions | boolean) {
  if (!existsSync(directory)) {
    return;
  }

  const files_ext_default = ["html", "js", "json", "css", "svg", "xml", "wasm"];
  let files_ext: string[];
  if (typeof options == "object") {
    files_ext = options.files ?? files_ext_default;
  } else {
    files_ext = files_ext_default;
  }
  const glob = new Glob(`**/*.{${files_ext.join()}}`);
  const files = Array.from(
    glob.scanSync({
      cwd: directory,
      dot: true,
      absolute: true,
      onlyFiles: true,
    }),
  );

  let doBr = false,
    doGz = false;

  if (options === true) {
    doBr = doGz = true;
  } else if (typeof options == "object") {
    doBr = options.brotli ?? false;
    doGz = options.gzip ?? false;
  }

  await Promise.all(
    files.map(file =>
      Promise.all([doGz && compress_file(file, "gz"), doBr && compress_file(file, "br")]),
    ),
  );
}

async function compress_file(file: string, format: "gz" | "br" = "gz") {
  const compress =
    format === "br"
      ? zlib.createBrotliCompress({
          params: {
            [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
            [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: statSync(file).size,
          },
        })
      : zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION });

  const source = createReadStream(file);
  const destination = createWriteStream(`${file}.${format}`);

  await pipe(source, compress, destination);
}

function patchServerWebsocketHandler(out: string) {
  let src = readFileSync(`${out}/index.js`, "utf8");
  const regex_gethook = /(this\.#options\.hooks\s+=\s+{)\s+(handle:)/gm;
  const substr_gethook = `$1 \nhandleWebsocket: module.handleWebsocket || null,\n$2`;
  const result1 = src.replace(regex_gethook, substr_gethook);

  const regex_sethook = /(this\.#options\s+=\s+options;)/gm;
  const substr_sethook = `$1\nthis.websocket = ()=>this.#options.hooks.handleWebsocket;`;
  const result = result1.replace(regex_sethook, substr_sethook);

  writeFileSync(`${out}/index.js`, result, "utf8");
}
