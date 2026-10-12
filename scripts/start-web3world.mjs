import { spawn } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, request as proxyRequest } from "node:http";
import { createServer as createNetServer } from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const distClient = path.join(root, "dist", "client");
const vinextCli = fileURLToPath(
  new URL("../node_modules/vinext/dist/cli.js", import.meta.url),
);

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const host = readArg("--hostname", process.env.HOSTNAME ?? "0.0.0.0");
const port = Number(readArg("--port", process.env.PORT ?? "3000"));

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function safeStaticPath(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return null;
  }
  if (!decoded.startsWith("/") || decoded.includes("\0") || decoded.includes("..")) {
    return null;
  }
  const candidate = path.resolve(distClient, `.${decoded}`);
  return candidate.startsWith(`${path.resolve(distClient)}${path.sep}`) ? candidate : null;
}

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        probe.close();
        reject(new Error("Could not reserve a local upstream port"));
        return;
      }
      probe.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

const upstreamPort = await findAvailablePort();
const upstream = spawn(
  process.execPath,
  [vinextCli, "start", "--hostname", "127.0.0.1", "--port", String(upstreamPort)],
  { cwd: root, stdio: "inherit" },
);

const server = createServer((req, res) => {
  const staticPath = safeStaticPath(req.url ?? "/");
  if (staticPath && existsSync(staticPath) && statSync(staticPath).isFile()) {
    const mime = contentTypes[path.extname(staticPath).toLowerCase()] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    createReadStream(staticPath).pipe(res);
    return;
  }

  const proxy = proxyRequest(
    {
      hostname: "127.0.0.1",
      port: upstreamPort,
      method: req.method,
      path: req.url,
      headers: req.headers,
    },
    (upstreamResponse) => {
      res.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(res);
    },
  );
  proxy.on("error", (error) => {
    if (!res.headersSent) res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`web3world upstream unavailable: ${error.message}`);
  });
  req.pipe(proxy);
});

server.listen(port, host, () => {
  console.log(`[web3world] Production server running at http://${host}:${port}`);
});

function shutdown() {
  server.close();
  upstream.kill();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
upstream.on("exit", (code) => {
  if (code && code !== 0) process.exitCode = code;
});
