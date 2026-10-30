import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../site/_worker.js';
import {LocalD1} from '../tools/d1-local.mjs';
const origin='https://reforma.example';
function setup(){const db=new LocalD1();let ip=1;return{db,async call(path,{method='GET',body,token,requestOrigin,requestIP}={}){
 const headers={'CF-Connecting-IP':requestIP||`10.0.0.${ip++}`};if(body!==undefined)headers['content-type']='application/json';if(token)headers.authorization=`Bearer ${token}`;if(requestOrigin)headers.origin=requestOrigin;
 const response=await worker.fetch(new Request(origin+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),{DB:db,ASSETS:{fetch:()=>new Response('asset')}});
 return{status:response.status,headers:response.headers,body:await response.json()};
}};}
async function create(t,code='REFORMA31',pin=''){const r=await t.call('/api/rooms',{method:'POST',body:{code,title:'Culto da Reforma',password:'teste-senha-segura',pin}});assert.equal(r.status,201);return r.body.token;}
async function join(t,code='REFORMA31',pin=''){const r=await t.call(`/api/rooms/${code}/join`,{method:'POST',body:{pin}});assert.equal(r.status,200);return r.body.token;}
const ask=(t,token,extra={})=>t.call('/api/rooms/REFORMA31/questions',{method:'POST',token,body:{text:'O que foi a Reforma Protestante?',anonymous:true,name:'Nome que não deve ser armazenado',submissionId:crypto.randomUUID(),...extra}});
test('fluxo real entre participante e organização, com seleção exclusiva para o telão',async()=>{
 const t=setup(),admin=await create(t),guest=await join(t);
 const created=await ask(t,guest);assert.equal(created.status,201);
 const list=await t.call('/api/rooms/REFORMA31/questions',{token:admin});assert.equal(list.body.counts.total,1);assert.equal(list.body.questions[0].name,null);
 assert.equal(JSON.stringify(list.body).includes('Nome que não'),false);assert.equal(JSON.stringify(list.body).includes('session_hash'),false);
 const before=await t.call('/api/rooms/REFORMA31/screen',{token:guest});assert.equal(before.body.featured,null);
 const feature=await t.call('/api/rooms/REFORMA31/featured',{method:'PATCH',token:admin,body:{id:created.body.id}});assert.equal(feature.status,200);
 const screen=await t.call('/api/rooms/REFORMA31/screen',{token:guest});assert.equal(screen.body.featured.text,'O que foi a Reforma Protestante?');assert.equal('questions' in screen.body,false);
 await t.call(`/api/rooms/REFORMA31/questions/${created.body.id}`,{method:'PATCH',token:admin,body:{status:'answered'}});
 assert.equal((await t.call('/api/rooms/REFORMA31/screen',{token:guest})).body.featured,null);
 t.db.close();
});
test('sem autenticação e com perfil de participante não se acessa painel, exportação ou controle',async()=>{
 const t=setup();await create(t);const guest=await join(t);
 for(const token of [undefined,guest]){
  for(const path of ['/questions','/export'])assert.ok([401,403].includes((await t.call('/api/rooms/REFORMA31'+path,{token})).status));
  assert.ok([401,403].includes((await t.call('/api/rooms/REFORMA31',{method:'PATCH',token,body:{isOpen:false}})).status));
  assert.ok([401,403].includes((await t.call('/api/rooms/REFORMA31',{method:'DELETE',token,body:{confirmCode:'REFORMA31'}})).status));
 }
 t.db.close();
});
test('tokens e identificadores de pergunta são isolados entre salas',async()=>{
 const t=setup(),admin=await create(t),other=await create(t,'OUTRASALA'),guest=await join(t),q=await ask(t,guest);
 assert.equal((await t.call('/api/rooms/OUTRASALA/questions',{token:admin})).status,401);
 assert.equal((await t.call(`/api/rooms/OUTRASALA/questions/${q.body.id}`,{method:'PATCH',token:other,body:{status:'archived'}})).status,404);
 assert.equal((await t.call('/api/rooms/OUTRASALA/featured',{method:'PATCH',token:other,body:{id:q.body.id}})).status,404);
 t.db.close();
});
test('senha do público, senha administrativa e sessões expiradas',async()=>{
 const t=setup();await create(t,'REFORMA31','mesa1234');
 assert.equal((await t.call('/api/rooms/REFORMA31/join',{method:'POST',body:{pin:'errada'}})).status,401);
 const guest=await join(t,'REFORMA31','mesa1234');
 assert.equal((await t.call('/api/rooms/REFORMA31/login',{method:'POST',body:{password:'mesa1234'}})).status,401);
 const login=await t.call('/api/rooms/REFORMA31/login',{method:'POST',body:{password:'teste-senha-segura'}});assert.equal(login.status,200);
 await t.db.exec('UPDATE sessions SET expires_at=0');
 assert.equal((await ask(t,guest)).status,401);
 const rows=t.db.sqlite.prepare('SELECT admin_hash,pin_hash FROM rooms').get();assert.ok(rows.admin_hash.startsWith('pbkdf2:'));assert.equal(rows.pin_hash.includes('mesa1234'),false);
 t.db.close();
});
test('repetir um envio não duplica perguntas, nem revela envios de outra sessão',async()=>{
 const t=setup(),admin=await create(t),guest=await join(t),id=crypto.randomUUID();
 const first=await ask(t,guest,{submissionId:id});const again=await ask(t,guest,{submissionId:id});
 assert.equal(again.body.id,first.body.id);assert.equal(again.body.duplicate,true);
 assert.equal((await ask(t,guest,{submissionId:id,text:'Pergunta diferente com o mesmo identificador'})).status,409);
 const other=await join(t);assert.equal((await ask(t,other,{submissionId:id})).status,409);
 assert.equal((await t.call('/api/rooms/REFORMA31/questions',{token:admin})).body.counts.total,1);
 t.db.close();
});
test('pausar, reabrir, arquivar, exportar e apagar a sala com confirmação',async()=>{
 const t=setup(),admin=await create(t),guest=await join(t);
 await t.call('/api/rooms/REFORMA31',{method:'PATCH',token:admin,body:{isOpen:false}});assert.equal((await ask(t,guest)).status,409);
 await t.call('/api/rooms/REFORMA31',{method:'PATCH',token:admin,body:{isOpen:true}});
 const q=await ask(t,guest,{anonymous:false,name:'Participante de exemplo'});
 await t.call(`/api/rooms/REFORMA31/questions/${q.body.id}`,{method:'PATCH',token:admin,body:{status:'archived'}});
 const list=await t.call('/api/rooms/REFORMA31/questions?status=archived',{token:admin});assert.equal(list.body.filteredTotal,1);
 const exported=await t.call('/api/rooms/REFORMA31/export',{token:admin});assert.equal(exported.body.questions[0].name,'Participante de exemplo');assert.equal('admin_hash' in exported.body.room,false);
 assert.equal((await t.call('/api/rooms/REFORMA31',{method:'DELETE',token:admin,body:{confirmCode:'ERRADO'}})).status,400);
 assert.equal((await t.call('/api/rooms/REFORMA31',{method:'DELETE',token:admin,body:{confirmCode:'REFORMA31'}})).status,200);
 assert.equal((await t.call('/api/rooms/REFORMA31')).status,404);assert.equal(t.db.sqlite.prepare('SELECT count(*) as n FROM questions').get().n,0);assert.equal(t.db.sqlite.prepare('SELECT count(*) as n FROM sessions').get().n,0);
 t.db.close();
});
test('limites, texto não confiável, origem indevida, rate limit e cabeçalhos',async()=>{
 const t=setup(),admin=await create(t),guest=await join(t);
 assert.equal((await ask(t,guest,{text:'curta'})).status,400);
 assert.equal((await ask(t,guest,{text:'a'.repeat(801)})).status,400);
 assert.equal((await ask(t,guest,{anonymous:false,name:''})).status,400);
 assert.equal((await t.call('/api/rooms/REFORMA31',{method:'PATCH',token:admin,requestOrigin:'https://evil.example',body:{isOpen:false}})).status,403);
 const text='<img src=x onerror=alert(1)> <script>teste</script>';
 assert.equal((await ask(t,guest,{text})).status,201);
 const list=await t.call('/api/rooms/REFORMA31/questions',{token:admin});assert.equal(list.body.questions[0].text,text);assert.equal(list.headers.get('cache-control'),'no-store');assert.ok(list.headers.get('content-security-policy').includes("script-src 'self'"));
 for(let i=0;i<9;i++)assert.equal((await ask(t,guest)).status,201);
 assert.equal((await ask(t,guest)).status,429);
 t.db.close();
});
test('sem banco a API informa indisponibilidade e nunca confirma envio',async()=>{
 const health=await worker.fetch(new Request(origin+'/api/health'),{});assert.equal((await health.json()).configured,false);
 const r=await worker.fetch(new Request(origin+'/api/rooms/REFORMA31/questions',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),{});assert.equal(r.status,503);assert.equal((await r.json()).ok,undefined);
});
