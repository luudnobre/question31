/* Cloudflare Pages, modo avançado. Bind de banco D1: DB.
   Nenhuma senha, chave de serviço ou lista de perguntas integra os arquivos estáticos. */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS rooms (
 code TEXT PRIMARY KEY, title TEXT NOT NULL, admin_hash TEXT NOT NULL,
 pin_hash TEXT, is_open INTEGER NOT NULL DEFAULT 1 CHECK(is_open IN (0,1)),
 featured_id TEXT, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN ('admin','guest')), expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_room ON sessions(room_code);
CREATE TABLE IF NOT EXISTS questions (
 id TEXT PRIMARY KEY, room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
 submission_id TEXT NOT NULL, session_hash TEXT NOT NULL, body TEXT NOT NULL,
 display_name TEXT, status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','answered','archived')),
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 UNIQUE(room_code, submission_id)
);
CREATE INDEX IF NOT EXISTS questions_room_date ON questions(room_code, created_at DESC);
CREATE INDEX IF NOT EXISTS questions_room_status ON questions(room_code, status, created_at DESC);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS rate_expiry ON rate_limits(expires_at);
`;
const ready = new WeakMap();
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };
const stamp = () => Date.now();
const bytes = new TextEncoder();
const hex = buffer => Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2,'0')).join('');
const unhex = value => Uint8Array.from(value.match(/../g) || [], p => parseInt(p,16));
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
async function digest(value) { return hex(await crypto.subtle.digest('SHA-256', bytes.encode(value))); }
async function passwordHash(value, salt = random().slice(0,32)) {
 const key = await crypto.subtle.importKey('raw', bytes.encode(value), 'PBKDF2', false, ['deriveBits']);
 const derived = await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:unhex(salt),iterations:100000}, key, 256);
 return `pbkdf2:100000:${salt}:${hex(derived)}`;
}
async function passwordMatches(value, stored) {
 if (!stored) return false;
 const parts = stored.split(':');
 const calculated = await passwordHash(value, parts[2]);
 let diff = calculated.length ^ stored.length;
 for (let i=0;i<stored.length;i++) diff |= stored.charCodeAt(i) ^ (calculated.charCodeAt(i) || 0);
 return diff === 0;
}
function codeOf(value) {
 const code = String(value || '').trim().toUpperCase();
 if (!/^[A-Z0-9]{4,12}$/.test(code)) fail(400,'Use um código de 4 a 12 letras ou números, sem espaços.');
 return code;
}
function clean(value, min, max, label) {
 if (typeof value !== 'string') fail(400,`${label}: preencha o campo.`);
 const result = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim();
 if (result.length < min || result.length > max) fail(400,`${label}: use de ${min} a ${max} caracteres.`);
 return result;
}
async function bodyOf(request) {
 if (!request.headers.get('content-type')?.includes('application/json')) fail(415,'Envie os dados em JSON.');
 if (Number(request.headers.get('content-length')) > 8192) fail(413,'Conteúdo muito grande.');
 const reader = request.body?.getReader();
 if (!reader) fail(400,'Envie os campos necessários.');
 const chunks=[]; let total=0;
 while (true) {
  const {done,value}=await reader.read(); if(done)break;
  total+=value.byteLength;
  if(total>8192){await reader.cancel();fail(413,'Conteúdo muito grande.');}
  chunks.push(value);
 }
 const combined=new Uint8Array(total);let position=0;
 for(const chunk of chunks){combined.set(chunk,position);position+=chunk.byteLength;}
 const text = new TextDecoder().decode(combined);
 try { const body = JSON.parse(text); if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error(); return body; }
 catch { fail(400,'Não foi possível ler os dados enviados.'); }
}
function json(value, status = 200) { return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}}); }
async function initialize(db) {
 if (!ready.has(db)) ready.set(db, db.batch(SCHEMA.split(';').map(sql=>sql.trim()).filter(Boolean).map(sql=>db.prepare(sql))).catch(error => {ready.delete(db); throw error;}));
 await ready.get(db);
}
async function throttle(db, request, scope, maximum, duration, identity = '') {
 const now = stamp();
 const identityPart = identity || request.headers.get('CF-Connecting-IP') || 'local';
 const key = await digest(`${scope}:${identityPart}:${Math.floor(now/duration)}`);
 const row = await db.prepare('INSERT INTO rate_limits(key,hits,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits').bind(key,now+duration).first();
 if (row.hits > maximum) fail(429,'Muitas tentativas. Aguarde um pouco e tente novamente.');
 // Uma limpeza limitada por janela de criação/autenticação evita acúmulo de contadores e sessões.
 if (scope.startsWith('create') || scope.startsWith('login')) {
  await db.batch([db.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now), db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now)]);
 }
}
async function roomOf(db, code) {
 const room = await db.prepare('SELECT * FROM rooms WHERE code=?').bind(code).first();
 if (!room) fail(404,'Sala não encontrada. Confira o código com a organização.');
 return room;
}
const publicRoom = room => ({code:room.code,title:room.title,isOpen:!!room.is_open,hasPin:!!room.pin_hash});
async function newSession(db, code, role) {
 const token = random();
 await db.prepare('INSERT INTO sessions(token_hash,room_code,role,expires_at) VALUES(?,?,?,?)').bind(await digest(token),code,role,stamp()+16*60*60*1000).run();
 return token;
}
async function authorize(db, request, code, adminOnly = false) {
 const token = (request.headers.get('authorization') || '').replace(/^Bearer /,'');
 if (!/^[a-f0-9]{64}$/.test(token)) fail(401,'Entre novamente na sala para continuar.');
 const tokenHash = await digest(token);
 const session = await db.prepare('SELECT role FROM sessions WHERE token_hash=? AND room_code=? AND expires_at>?').bind(tokenHash,code,stamp()).first();
 if (!session) fail(401,'Sua sessão expirou. Entre novamente.');
 if (adminOnly && session.role !== 'admin') fail(403,'Esta ação é exclusiva da organização.');
 return {...session,tokenHash};
}
function questionView(row, featuredId) {
 return {id:row.id,text:row.body,name:row.display_name || null,status:row.status,createdAt:row.created_at,featured:row.id === featuredId};
}
async function route(request, env) {
 const url = new URL(request.url), path = url.pathname.replace(/\/$/,'');
 if (request.method !== 'GET' && request.method !== 'HEAD') {
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) fail(403,'Origem não autorizada.');
 }
 if (path === '/api/health' && request.method === 'GET') {
  if (!env.DB) return json({configured:false,message:'Falta conectar o banco D1 com o nome DB. Consulte COMECE-AQUI.html.'});
  await initialize(env.DB);
  return json({configured:true,mode:'online'});
 }
 if (!env.DB) fail(503,'O modo online ainda não foi configurado. Conecte um banco D1 chamado DB e publique novamente.');
 const db = env.DB;
 await initialize(db);
 if (path === '/api/rooms' && request.method === 'POST') {
  await throttle(db,request,'create',8,60*60*1000);
  const body = await bodyOf(request), code = codeOf(body.code), title = clean(body.title,3,80,'Nome do encontro');
  const password = clean(body.password,8,128,'Senha da organização');
  const pin = body.pin ? clean(body.pin,4,32,'Senha de participação') : null;
  const existing = await db.prepare('SELECT code FROM rooms WHERE code=?').bind(code).first();
  if (existing) fail(409,'Este código já está em uso. Escolha outro código para criar sua sala.');
  const adminHash = await passwordHash(password), pinHash = pin ? await passwordHash(pin) : null;
  try { await db.prepare('INSERT INTO rooms(code,title,admin_hash,pin_hash,created_at) VALUES(?,?,?,?,?)').bind(code,title,adminHash,pinHash,stamp()).run(); }
  catch (error) { if (/UNIQUE|constraint/i.test(error.message)) fail(409,'Este código já está em uso. Escolha outro.'); throw error; }
  return json({room:{code,title,isOpen:true,hasPin:!!pin},token:await newSession(db,code,'admin')},201);
 }
 const match = path.match(/^\/api\/rooms\/([A-Za-z0-9]+)(?:\/(.*))?$/);
 if (!match) fail(404,'Caminho não encontrado.');
 const code = codeOf(match[1]), tail = match[2] || '';
 const room = await roomOf(db,code);
 if (!tail && request.method === 'GET') return json({room:publicRoom(room)});
 if (tail === 'join' && request.method === 'POST') {
  await throttle(db,request,`join:${code}`,1500,15*60*1000);
  const body = await bodyOf(request);
  if (room.pin_hash) {
   if (typeof body.pin !== 'string' || !await passwordMatches(body.pin,room.pin_hash)) {
    await throttle(db,request,`pin-failure:${code}`,25,15*60*1000);
    fail(401,'Senha de participação incorreta. Confira com a organização.');
   }
  }
  return json({room:publicRoom(room),token:await newSession(db,code,'guest')});
 }
 if (tail === 'login' && request.method === 'POST') {
  await throttle(db,request,`login:${code}`,12,15*60*1000);
  const body = await bodyOf(request);
  if (typeof body.password !== 'string' || body.password.length>128 || !await passwordMatches(body.password,room.admin_hash)) fail(401,'Senha da organização incorreta.');
  return json({room:publicRoom(room),token:await newSession(db,code,'admin')});
 }
 if (tail === 'screen' && request.method === 'GET') {
  await authorize(db,request,code);
  const featured = room.featured_id ? await db.prepare('SELECT * FROM questions WHERE id=? AND room_code=? AND status=\'new\'').bind(room.featured_id,code).first() : null;
  return json({room:publicRoom(room),featured:featured ? {id:featured.id,text:featured.body,name:featured.display_name || null} : null});
 }
 if (tail === 'questions' && request.method === 'POST') {
  const session = await authorize(db,request,code);
  const body = await bodyOf(request);
  const text = clean(body.text,8,800,'Pergunta');
  if (typeof body.anonymous !== 'boolean') fail(400,'Escolha a forma de envio.');
  const name = body.anonymous ? null : clean(body.name,2,60,'Seu nome');
  if (typeof body.submissionId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(body.submissionId)) fail(400,'Identificador de envio inválido. Recarregue a página.');
  const existing = await db.prepare('SELECT id,session_hash,body,display_name FROM questions WHERE room_code=? AND submission_id=?').bind(code,body.submissionId).first();
  if (existing) {
   if (existing.session_hash !== session.tokenHash || existing.body !== text || existing.display_name !== name) fail(409,'Este identificador de envio já foi utilizado.');
   return json({ok:true,id:existing.id,duplicate:true});
  }
  if (!room.is_open) fail(409,'A organização pausou o recebimento de perguntas.');
  await throttle(db,request,`question:${code}`,10,60*1000,session.tokenHash);
  const id = crypto.randomUUID(), now = stamp();
  // A condição do INSERT mantém o limite correto mesmo sob envios concorrentes.
  const result = await db.prepare(`INSERT INTO questions(id,room_code,submission_id,session_hash,body,display_name,created_at,updated_at)
   SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM questions WHERE room_code=?) < 2000 AND EXISTS(SELECT 1 FROM rooms WHERE code=? AND is_open=1)
   ON CONFLICT(room_code,submission_id) DO NOTHING`).bind(id,code,body.submissionId,session.tokenHash,text,name,now,now,code,code).run();
  if (!result.meta.changes) {
   const retry = await db.prepare('SELECT id,session_hash,body,display_name FROM questions WHERE room_code=? AND submission_id=?').bind(code,body.submissionId).first();
   if (retry && retry.session_hash === session.tokenHash && retry.body === text && retry.display_name === name) return json({ok:true,id:retry.id,duplicate:true});
   fail(409,'A sala está pausada, atingiu 2.000 perguntas ou este envio já foi usado. Consulte a organização.');
  }
  return json({ok:true,id},201);
 }
 const session = await authorize(db,request,code,true);
 if (tail === 'logout' && request.method === 'POST') {
  await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(session.tokenHash).run();
  return json({ok:true});
 }
 if (tail === 'questions' && request.method === 'GET') {
  const status = url.searchParams.get('status') || 'all';
  if (!['all','new','answered','archived'].includes(status)) fail(400,'Filtro inválido.');
  const offset = Math.max(0,Math.min(2000,parseInt(url.searchParams.get('offset') || '0',10) || 0));
  const limit = Math.max(1,Math.min(100,parseInt(url.searchParams.get('limit') || '50',10) || 50));
  const count = await db.prepare(`SELECT COUNT(*) AS total,
   COALESCE(SUM(CASE WHEN status='new' THEN 1 ELSE 0 END),0) AS new,
   COALESCE(SUM(CASE WHEN status='answered' THEN 1 ELSE 0 END),0) AS answered,
   COALESCE(SUM(CASE WHEN status='archived' THEN 1 ELSE 0 END),0) AS archived FROM questions WHERE room_code=?`).bind(code).first();
  const rows = status === 'all'
   ? await db.prepare('SELECT * FROM questions WHERE room_code=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?').bind(code,limit,offset).all()
   : await db.prepare('SELECT * FROM questions WHERE room_code=? AND status=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?').bind(code,status,limit,offset).all();
  return json({room:publicRoom(room),questions:rows.results.map(row=>questionView(row,room.featured_id)),counts:count,filteredTotal:status==='all'?count.total:count[status],featuredId:room.featured_id});
 }
 if (tail === 'export' && request.method === 'GET') {
  const rows = await db.prepare('SELECT * FROM questions WHERE room_code=? ORDER BY created_at,id').bind(code).all();
  return json({room:publicRoom(room),exportedAt:stamp(),questions:rows.results.map(row=>questionView(row,room.featured_id))});
 }
 if (!tail && request.method === 'PATCH') {
  const body = await bodyOf(request);
  if (typeof body.isOpen !== 'boolean') fail(400,'Situação inválida.');
  await db.prepare('UPDATE rooms SET is_open=? WHERE code=?').bind(body.isOpen?1:0,code).run();
  return json({ok:true});
 }
 if (!tail && request.method === 'DELETE') {
  const body = await bodyOf(request);
  if (body.confirmCode !== code) fail(400,'Digite o código da sala para confirmar.');
  await db.batch([db.prepare('DELETE FROM questions WHERE room_code=?').bind(code),db.prepare('DELETE FROM sessions WHERE room_code=?').bind(code),db.prepare('DELETE FROM rooms WHERE code=?').bind(code)]);
  return json({ok:true});
 }
 if (tail === 'featured' && request.method === 'PATCH') {
  const body = await bodyOf(request);
  if (body.id === null) { await db.prepare('UPDATE rooms SET featured_id=NULL WHERE code=?').bind(code).run(); return json({ok:true}); }
  if (typeof body.id !== 'string') fail(400,'Selecione uma pergunta.');
  const changed = await db.prepare(`UPDATE rooms SET featured_id=? WHERE code=? AND EXISTS(SELECT 1 FROM questions WHERE id=? AND room_code=? AND status='new')`).bind(body.id,code,body.id,code).run();
  if (!changed.meta.changes) fail(404,'Pergunta indisponível para exibição.');
  return json({ok:true});
 }
 const questionPath = tail.match(/^questions\/([a-zA-Z0-9-]+)$/);
 if (questionPath && request.method === 'PATCH') {
  const body = await bodyOf(request), id = questionPath[1];
  if (!['new','answered','archived'].includes(body.status)) fail(400,'Situação inválida.');
  const exists = await db.prepare('SELECT id FROM questions WHERE id=? AND room_code=?').bind(id,code).first();
  if (!exists) fail(404,'Pergunta não encontrada.');
  await db.batch([
   db.prepare('UPDATE questions SET status=?,updated_at=? WHERE id=? AND room_code=?').bind(body.status,stamp(),id,code),
   db.prepare('UPDATE rooms SET featured_id=NULL WHERE code=? AND featured_id=?').bind(code,id)
  ]);
  return json({ok:true});
 }
 fail(404,'Ação não encontrada.');
}
function secure(response, isApi = false) {
 const headers = new Headers(response.headers);
 headers.set('x-content-type-options','nosniff');
 headers.set('referrer-policy','no-referrer');
 headers.set('x-frame-options','DENY');
 headers.set('permissions-policy','camera=(), microphone=(), geolocation=()');
 headers.set('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'");
 if (isApi) headers.set('cache-control','no-store');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
export default {
 async fetch(request,env) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) {
   try { return secure(await route(request,env),true); }
   catch (error) { return secure(json({error:error instanceof HttpError?error.message:'Não foi possível concluir agora. Tente novamente em instantes.'},error instanceof HttpError?error.status:503),true); }
  }
  if (url.pathname === '/_worker.js' || /\.(?:sql|mjs)$/.test(url.pathname)) return secure(new Response('Não encontrado',{status:404}));
  return secure(await env.ASSETS.fetch(request));
 }
};
