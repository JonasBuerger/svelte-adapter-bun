/*! MIT © Volodymyr Palamar https://github.com/gornostay25/svelte-adapter-bun */
import { serve, type Serve } from "bun";
import { build_options, hostname, port, development } from "./env";
import handler from "./handler";

const { fetch, websocket } = handler(build_options.assets ?? true);

const serverOptions: Serve = {
  //baseURI: env("ORIGIN", undefined),
  fetch,
  hostname,
  port,
  development,
  error(error) {
    console.error(error);
    return new Response("Uh oh!!", { status: 500 });
  },
  websocket,
};

const server = serve(serverOptions);
console.info(`Listening on ${hostname + ":" + port}` + (websocket ? " (Websocket)" : ""));
if (development) {
  console.info(serverOptions);
}

const cleanup = () => {
  if (development) {
    console.log("Stop signal received, closing server");
  }
  server.stop(true);
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("SIGQUIT", cleanup);
process.on("SIGSTOP", cleanup);
process.on("SIGKILL", cleanup);
