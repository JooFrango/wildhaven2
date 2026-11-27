import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const prefix='/build%20real/continental/clareiras-v01/';
export const server=http.createServer((req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/'){res.writeHead(302,{Location:prefix+'index.html'});return res.end();}
  const name=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  const rel=path.relative(root,name);
  if(rel.startsWith('..')||path.isAbsolute(rel)||rel.split(path.sep).some(x=>x.startsWith('.')))throw Error();
  const stat=fs.statSync(name);if(!stat.isFile())throw Error();
  const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.glb':'model/gltf-binary','.json':'application/json'};
  res.writeHead(200,{'Content-Type':mime[path.extname(name)]??'application/octet-stream','Content-Length':stat.size});fs.createReadStream(name).pipe(res);
 }catch{res.writeHead(404);res.end();}
});
server.listen(Number(process.env.PORT??4183),'127.0.0.1',()=>console.log('http://127.0.0.1:'+server.address().port+'/'));