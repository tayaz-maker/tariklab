import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';

const mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};

/** Read before committing headers so a missing baseline asset is a real 404. */
export function createStaticGameServer(directory) {
 const root=resolve(directory);
 return createServer(async(req,res)=>{
  try {
   const url=new URL(req.url,'http://localhost');
   const path=decodeURIComponent(url.pathname);
   const file=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));
   if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
   const body=await readFile(file);
   res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(body);
  } catch(error) {
   res.writeHead(error instanceof URIError?400:error.code==='ENOENT'||error.code==='EISDIR'?404:500).end();
  }
 });
}
