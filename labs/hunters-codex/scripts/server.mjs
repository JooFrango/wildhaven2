import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png'};
http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');let p=resolve(root,'.'+decodeURIComponent(u.pathname.replace(/^\/repo\//,'/')));if(p!==resolve(root)&&!p.startsWith(resolve(root)+sep)){res.writeHead(403).end();return;}if((await stat(p)).isDirectory())p=resolve(p,'hunter-lab.html');const b=await readFile(p);res.writeHead(200,{'Content-Type':types[extname(p)]??'application/octet-stream','Cache-Control':'no-cache'}).end(b);}catch{res.writeHead(404).end('Não encontrado');}}).listen(8782,'127.0.0.1',()=>console.log('Hunter Lab Codex: http://127.0.0.1:8782/labs/hunters-codex/hunter-lab.html'));
