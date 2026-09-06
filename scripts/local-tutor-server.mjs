import fs from "node:fs";
import path from "node:path";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { fromRoot } from "./lib/project.mjs";

export async function startTutor(port = 4173) {
  const bundle = await build({ entryPoints: [fromRoot("apps/replay-web/src/index.ts")], bundle: true, write: false,
    platform: "browser", format: "esm", target: "es2022" });
  const files = new Map([
    ["/", ["text/html; charset=utf-8", fs.readFileSync(fromRoot("apps/replay-web/index.html"))]],
    ["/style.css", ["text/css; charset=utf-8", fs.readFileSync(fromRoot("apps/replay-web/style.css"))]],
    ["/src/bundle.js", ["text/javascript; charset=utf-8", bundle.outputFiles[0].contents]],
  ]);
  const server = createServer((request, response) => {
    const file = files.get(request.url);
    if (request.method !== "GET" || !file) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { "Content-Type": file[0], "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
    response.end(file[1]);
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const server = await startTutor();
  console.log(`Local deterministic tutor: ${server.url} (Ctrl+C to stop)`);
}
