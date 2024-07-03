declare module "bunsirv" {
  import type { Stats } from "fs";

  type Arrayable<T> = T | T[];
  export type NextHandler = () => void | Promise<void>;
  export type RequestHandler = (req: Request, next?: NextHandler) => void | Response | Promise<void | Response>;

  type SirvFile = {filepath: string, stats:Stats, headers:Headers}
  type SirvFilesGetter = (uri: string, extns: string[]) => SirvFile

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

  export default function (dir?: string, opts?: Options): RequestHandler;
}
