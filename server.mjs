import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const rootPath = normalize(root);
const distRoot = normalize(join(root, "dist", "el-faraon"));
const serveRoot = existsSync(distRoot) ? distRoot : rootPath;
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1:4173").pathname;
  const targetPath = pathname === "/" || pathname === "" ? "/index.html" : pathname;
  let filePath = normalize(join(serveRoot, targetPath));
  if (serveRoot === distRoot && !existsSync(filePath) && !extname(targetPath)) filePath = join(distRoot, "index.html");
  if (!filePath.toLowerCase().startsWith(serveRoot.toLowerCase())) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  try {
    const body = await readFile(filePath);
    response.writeHead(200, { "Content-Type": types[extname(filePath)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}).listen(4173, "127.0.0.1", () => {
  console.log("El Faraón landing disponible en http://127.0.0.1:4173");
});
