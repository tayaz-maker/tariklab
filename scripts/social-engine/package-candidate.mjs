// Portable local candidate. Never opens a browser, deploys, or changes a user's save.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const destination = resolve(process.env.SE_PACKAGE_DIR || "../portable-social-engine");
const publicDir = "public/games/social-engine";
const manifestBytes = await readFile(`${publicDir}/build-manifest.json`);
const manifest = JSON.parse(manifestBytes);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const files = [...manifest.assets, ...manifest.playableAssets].map((a) => a.file);
files.push("build-manifest.json", "THIRD_PARTY_LICENSES.txt", "assets/kiyiyaka-map.json");
for (const file of files) {
  const target = resolve(destination, "public/games/social-engine", file);
  await mkdir(dirname(target), { recursive: true });
  const bytes = await readFile(`${publicDir}/${file}`);
  const expected = [...manifest.assets, ...manifest.playableAssets].find((a) => a.file === file);
  if (expected && expected.sha256 !== sha256(bytes)) throw new Error(`Asset mismatch: ${file}`);
  await writeFile(target, bytes);
}
const server = `import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const allowed=new Set(${JSON.stringify(files.map((f) => "/games/social-engine/" + f))});
const port=Number(process.env.SE_PORT||8107);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('SE_PORT must be1024..65535');
const types={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.png':'image/png'};
const server=createServer(async(req,res)=>{
  try{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;}
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/'){res.writeHead(302,{'Location':'/games/social-engine/index.html'});res.end();return;}
    if(!allowed.has(pathname)){res.writeHead(404);res.end('Not found');return;}
    const data=await readFile(fileURLToPath(new URL('./public'+pathname,import.meta.url)));
    const ext=pathname.slice(pathname.lastIndexOf('.'));
    res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Content-Length':data.length,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});
    res.end(req.method==='HEAD'?undefined:data);
  }catch(error){res.writeHead(error instanceof URIError?400:500);res.end('Request could not be served');}
});
server.listen(port,'127.0.0.1',()=>console.log('SOCIAL ENGINE local candidate: http://127.0.0.1:'+port+'/games/social-engine/index.html\\nBrowser is NOT opened automatically. Stop with Ctrl+C.'));
`;
await writeFile(resolve(destination, "start.mjs"), server);
await writeFile(
  resolve(destination, "PLAYER_GUIDE.md"),
  (await readFile("docs/social-engine/PLAYER_GUIDE.md", "utf8")).replaceAll(
    "http://127.0.0.1:8097",
    "http://127.0.0.1:8107",
  ),
);
await writeFile(
  resolve(destination, "README.txt"),
  `SOCIAL ENGINE — DARAMCIK · yerel oyun adayı

Node.js 22 veya üzeri gerekir. Bu klasörde «node start.mjs» komutunu çalıştır.
Oynamak istediğinde terminalde yazan adresi kendin aç. Pencere otomatik açılmaz.
Durdurmak için Ctrl+C tuşlarına bas. İnternet bağlantısı veya npm kurulumu gerekmez.

Sunucu yalnızca bu bilgisayarda çalışır. Oyun kayıtları kullandığın tarayıcıda
kalır. Portu veya tarayıcıyı değiştireceksen önce oyun menüsünden kaydını dışa aktar.
Karakter oluşturma, ilk vardiya ve diğer kontroller PLAYER_GUIDE.md dosyasındadır.

Bu paket yerel geliştirme adayıdır. İki insan oynanış testi, hedef cihazlar ve
yayın doğrulaması henüz tamamlanmamıştır.
Oyun manifest SHA-256: ${sha256(manifestBytes)}
`,
);
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const runtimeFile = publicDir + "/build-manifest.json";
const runtimeCommit = git("log", "-1", "--format=%H", "--", runtimeFile);
if (
  sha256(execFileSync("git", ["show", runtimeCommit + ":" + runtimeFile])) !== sha256(manifestBytes)
)
  throw Error("Uncommitted runtime must not be packaged");
const report = {
  status: "PACKAGED_NOT_RELEASED",
  createdAt: new Date().toISOString(),
  branch: git("branch", "--show-current") || null,
  runtimeCommit,
  checkpointCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  runtimeManifestSha256: sha256(manifestBytes),
  runtimeSourceDigest: manifest.sourceDigest,
  files,
  automaticallyOpensBrowser: false,
  remotelyDeploys: false,
};
await writeFile(resolve(destination, "CANDIDATE.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ destination, files: files.length, status: report.status }));
