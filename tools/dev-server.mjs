import http from 'node:http';
import {readFile,mkdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import worker from '../site/_worker.js';
import {LocalD1} from './d1-local.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await mkdir(path.join(root,'.local'),{recursive:true});
const db=new LocalD1(path.join(root,'.local','reforma.sqlite'));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
const assets={async fetch(request){
 const url=new URL(request.url);let name;
 try{name=decodeURIComponent(url.pathname);}catch{return new Response('Inválido',{status:400});}
 if(name==='/')name='/index.html';
 const target=path.resolve(root,'site',`.${name}`),siteRoot=path.join(root,'site')+path.sep;
 if(!target.startsWith(siteRoot))return new Response('Proibido',{status:403});
 try{if(!(await stat(target)).isFile())return new Response('Não encontrado',{status:404});const data=await readFile(target);return new Response(data,{headers:{'content-type':mime[path.extname(target)]||'application/octet-stream'}});}catch{return new Response('Não encontrado',{status:404});}
}};
const server=http.createServer(async(req,res)=>{
 try{
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>8192){res.writeHead(413);res.end('Conteúdo muito grande');return;}chunks.push(chunk);}
  const origin=`http://${req.headers.host}`,headers=new Headers();
  for(const [key,value] of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);
  // O IP é usado apenas pelo limitador local; produção usa CF-Connecting-IP.
  headers.set('CF-Connecting-IP',req.socket.remoteAddress||'local');
  const request=new Request(new URL(req.url,origin),{method:req.method,headers,body:chunks.length?Buffer.concat(chunks):undefined});
  const response=await worker.fetch(request,{DB:db,ASSETS:assets});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('Erro no servidor local.');}
});
const portIndex=process.argv.indexOf('--port');
const port=Number(process.env.PORT || (portIndex>=0?process.argv[portIndex+1]:3000))||3000;
server.listen(port,'0.0.0.0',()=>console.log(`Reforma · desenvolvimento em http://localhost:${port}`));
