/*! MIT © Luke Edwards https://github.com/lukeed/sirv/blob/master/packages/sirv/index.js */
import { existsSync, statSync, type Stats } from "fs";
import { join, normalize, resolve } from "path";
import { totalist } from "totalist/sync";

type Arrayable<T> = T | T[];
export type NextHandler = () => void | Promise<void>;
export type RequestHandler = (
  req: Request,
  next?: NextHandler,
) => void | Response | Promise<void | Response>;

type SirvFile = { filepath: string; stats: Stats; headers: Headers };
type SirvFilesGetter = (uri: string, extns: string[]) => SirvFile;

interface Options {
  dev?: boolean;
  etag?: boolean;
  maxAge?: number;
  immutable?: boolean;
  single?: string | boolean;
  ignores?: false | Arrayable<string | RegExp>;
  extensions?: string[];
  dotfiles?: boolean;
  brotli?: boolean;
  gzip?: boolean;
  onNoMatch?: (req: Request, next: NextHandler) => Response;
  setHeaders?: (headers: Headers, pathname: string, stats: Stats) => void;
}

function toAssume(uri: string, extns: string[]): string[] {
  let i = 0,
    x: string,
    len = uri.length - 1;
  if (uri.charCodeAt(len) === 47) {
    uri = uri.substring(0, len);
  }

  let arr = [],
    tmp = `${uri}/index`;
  for (; i < extns.length; i++) {
    x = extns[i] ? `.${extns[i]}` : "";
    if (uri) arr.push(uri + x);
    arr.push(tmp + x);
  }

  return arr;
}

function viaCache(cache: Record<string, SirvFile>, uri: string, extns: string[]): SirvFile | void {
  let i = 0,
    data: SirvFile,
    arr = toAssume(uri, extns);
  for (; i < arr.length; i++) {
    if ((data = cache[arr[i]])) return data;
  }
}

function viaLocal(dir: string, isEtag: boolean, uri: string, extns: string[]): SirvFile | void {
  let i = 0,
    arr = toAssume(uri, extns);
  let filepath: string, stats: Stats, name: string, headers: Headers;
  for (; i < arr.length; i++) {
    filepath = normalize(join(dir, (name = arr[i])));
    if (filepath.startsWith(dir) && existsSync(filepath)) {
      stats = statSync(filepath);
      if (stats.isDirectory()) continue;
      headers = toHeaders(name, stats, isEtag);
      headers.set("Cache-Control", isEtag ? "no-cache" : "no-store");
      return { filepath, stats, headers };
    }
  }
}

const is404: RequestHandler = () => {
  return new Response(null, {
    status: 404,
    statusText: "404 Not Found",
  });
};

function send(req: Request, filepath: string, stats: Stats, headers: Headers): Response {
  let code = 200,
    opts: { end?: number; start?: number; range?: boolean } = {};

  if (req.headers.has("range")) {
    code = 206;
    let [x, y] = req.headers.get("range").replace("bytes=", "").split("-");
    let end = (opts.end = parseInt(y, 10) || stats.size - 1);
    let start = (opts.start = parseInt(x, 10) || 0);

    if (end >= stats.size) {
      end = stats.size - 1;
    }
    if (start >= stats.size) {
      headers.set("Content-Range", `bytes */${stats.size}`);
      return new Response(null, {
        headers: headers,
        status: 416,
      });
    }

    headers.set("Content-Range", `bytes ${start}-${end}/${stats.size}`);
    headers.set("Content-Length", (end - start + 1).toString());
    headers.set("Accept-Ranges", "bytes");
    opts.range = true;
  }

  if (opts.range) {
    return new Response(Bun.file(filepath).slice(opts.start, opts.end), {
      headers: headers,
      status: code,
    });
  }

  return new Response(Bun.file(filepath), {
    headers: headers,
    status: code,
  });
}

const ENCODING = {
  ".br": "br",
  ".gz": "gzip",
};

function toHeaders(name: string, stats: Stats, isEtag: boolean): Headers {
  let enc = ENCODING[name.slice(-3)];

  if (enc) {
    name = name.slice(0, -3);
  }

  let ctype = Bun.file(name).type;

  let headers = new Headers({
    "Content-Length": stats.size.toString(),
    "Content-Type": ctype,
    "Last-Modified": stats.mtime.toUTCString(),
  });

  if (enc) {
    headers.set("Content-Encoding", enc);
    const dummy = new Response(Bun.file(name));
    if (dummy.headers.has("content-deposition"))
      headers.set("content-deposition", dummy.headers.get("content-deposition"));
  }

  if (isEtag) headers.set("ETag", `W/"${stats.size}-${stats.mtime.getTime()}"`);

  return headers;
}

export default function (dir: string, opts: Options = {}): RequestHandler {
  dir = resolve(dir || ".");

  let isNotFound = opts.onNoMatch || is404;
  let setHeaders = opts.setHeaders || false;

  let extensions = opts.extensions || ["html", "htm"];
  let gzips = opts.gzip && extensions.map(x => `${x}.gz`).concat("gz");
  let brots = opts.brotli && extensions.map(x => `${x}.br`).concat("br");

  const FILES: Record<string, SirvFile> = {};

  let isEtag = !!opts.etag;

  let ignores = [];
  if (opts.ignores !== false) {
    ignores.push(/\/([A-Za-z\s\d~$._-]+\.\w+)+$/); // any extn
    if (opts.dotfiles) ignores.push(/\/\.\w/);
    else ignores.push(/\/\.well-known/);
    [].concat(opts.ignores || []).forEach(x => {
      ignores.push(new RegExp(x, "i"));
    });
  }

  let cc = opts.maxAge != null && `public,max-age=${opts.maxAge}`;
  if (cc && opts.immutable) cc += ",immutable";
  else if (cc && opts.maxAge === 0) cc += ",must-revalidate";

  if (!opts.dev) {
    totalist(dir, (name, filepath, stats) => {
      if (/\.well-known[\\+\/]/.test(name)) {
      } // keep
      else if (!opts.dotfiles && /(^\.|[\\+|\/]\.)/.test(name)) return;

      let headers = toHeaders(name, stats, isEtag);
      if (cc) headers.set("Cache-Control", cc);

      FILES["/" + name.normalize().replace(/\\+/g, "/")] = { filepath, stats, headers };
    });
  }

  let lookup: SirvFilesGetter = opts.dev ? viaLocal.bind(0, dir, isEtag) : viaCache.bind(0, FILES);

  return function (req, next) {
    let extns = [""];
    let pathname = new URL(req.url).pathname;
    let val = req.headers.get("accept-encoding") || "";
    if (gzips && val.includes("gzip")) extns.unshift(...gzips);
    if (brots && /(br|brotli)/i.test(val)) extns.unshift(...brots);
    extns.push(...extensions); // [...br, ...gz, orig, ...exts]

    if (pathname.indexOf("%") !== -1) {
      try {
        pathname = decodeURI(pathname);
      } catch (err) {
        /* malform uri */
      }
    }

    const sirvFile = lookup(pathname, extns);
    if (opts.dev) {
      console.info("Bunsirv Lookup:", sirvFile ? sirvFile.filepath : sirvFile);
    }
    if (!sirvFile) return next ? next() : isNotFound(req, next);

    let { filepath = "", stats = undefined, headers = undefined } = sirvFile;

    if (isEtag && req.headers.get("if-none-match") === headers.get("ETag")) {
      return new Response(null, { status: 304 });
    }
    headers = new Headers(headers);

    if (gzips || brots) {
      headers.append("Vary", "Accept-Encoding");
    }

    if (setHeaders) {
      setHeaders(headers, pathname, stats);
    }
    return send(req, filepath, stats, headers);
  };
}
