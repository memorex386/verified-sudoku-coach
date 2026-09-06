import fs from "node:fs";
import path from "node:path";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { fromRoot } from "./lib/project.mjs";

export async function startTutor(port = 4173, gateway = null) {
  const bundle = await build({ entryPoints: [fromRoot("apps/replay-web/src/index.ts")], bundle: true, write: false,
    platform: "browser", format: "esm", target: "es2022" });
  let html = fs.readFileSync(fromRoot("apps/replay-web/index.html"), "utf8");
  if (gateway) html = html.replace("</head>", `<meta name="coach-capability" content="${gateway.capability}"></head>`)
    .replace("Deterministic tutor · no live AI", "Local AI coach · verified facts");
  const files = new Map([
    ["/", ["text/html; charset=utf-8", html]],
    ["/style.css", ["text/css; charset=utf-8", fs.readFileSync(fromRoot("apps/replay-web/style.css"))]],
    ["/src/bundle.js", ["text/javascript; charset=utf-8", bundle.outputFiles[0].contents]],
  ]);
  const server = createServer((request, response) => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    if (request.headers.host !== new URL(origin).host) { response.writeHead(403); response.end(); return; }
    if (gateway && request.url?.startsWith("/coach/")) {
      void gateway.handle(request, response, origin).catch(() => { if (!response.headersSent) response.writeHead(500); response.end(); }); return;
    }
    const file = files.get(request.url);
    if (request.method !== "GET" || !file) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { "Content-Type": file[0], "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": `default-src 'self'; connect-src ${gateway ? "'self'" : "'none'"}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'` });
    response.end(file[1]);
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => { gateway?.close(); return new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const server = await startTutor();
  console.log(`Local deterministic tutor: ${server.url} (Ctrl+C to stop)`);
}
