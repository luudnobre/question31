/* Reforma — interface sem bibliotecas ou serviços externos no navegador. */
(() => {
 'use strict';
 const $ = (selector, root=document) => root.querySelector(selector);
 const main = $('#conteudo'), dialog = $('#dialog');
 const memory = new Map();
 const app = {demo:false,code:'',room:null,timer:null,version:0,filter:'new',page:0,formTab:'login',lastSubmission:null};
 const icon = name => {
  const paths = {arrow:'<path d="M4 12h16M14 6l6 6-6 6"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/>',send:'<path d="M22 2L9 15M22 2l-7 20-6-7-7-6 20-7z"/>',copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',screen:'<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',check:'<path d="M4 12l5 5L20 6"/>',pause:'<path d="M8 5v14M16 5v14"/>',play:'<path d="M7 4l14 8-14 8V4z"/>',download:'<path d="M12 3v12m-5-5l5 5 5-5M4 16v5h16v-5"/>',person:'<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0116 0v2"/>',archive:'<rect x="3" y="3" width="18" height="5" rx="1"/><path d="M5 8v13h14V8M9 12h6"/>'};
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
 };
 const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const normalCode = value => String(value || '').trim().toUpperCase();
 const validCode = value => /^[A-Z0-9]{4,12}$/.test(value);
 function uid() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`; }
 const dateTime = ms => new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Recife',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(ms));
 const timeNow = () => new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Recife',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date());
 const suffix = () => app.demo ? '?demo=1' : '';
 const link = path => `#/${path}${suffix()}`;
 const base = code => `/api/rooms/${encodeURIComponent(code)}`;
 const tokenKey = (code,role) => `reforma:${app.demo?'demo':'online'}:${code}:${role}`;
 function stored(key,value) {
  if (value === undefined) { try {return sessionStorage.getItem(key) || memory.get(key);}catch {return memory.get(key);} }
  if (value === null) {memory.delete(key);try {sessionStorage.removeItem(key);}catch{}return;}
  memory.set(key,value);try {sessionStorage.setItem(key,value);}catch{}
 }
 function getToken(code, admin=false) {return stored(tokenKey(code,'admin')) || (!admin && stored(tokenKey(code,'guest'))) || '';}
 function saveToken(code,role,token) {stored(tokenKey(code,role),token);}
 function go(path) {location.hash = `/${path}${suffix()}`;}
 function toast(message,error=false) {
  const el=document.createElement('div');el.className=`toast${error?' error':''}`;el.textContent=message;$('#toasts').append(el);setTimeout(()=>el.remove(),6500);
 }
 function formError(form,message) {const el=$('.form-error',form);if(el){el.textContent=message;el.hidden=false;}else toast(message,true);}
 function setBusy(form,busy) {form.querySelectorAll('button[type=submit]').forEach(button=>button.disabled=busy);form.setAttribute('aria-busy',String(busy));}
 function modal(html,onSubmit) {
  $('#dialog-content').innerHTML=`<div class="modal-content"><button class="modal-close" data-action="close-dialog" aria-label="Fechar">×</button>${html}</div>`;
  if (!dialog.open) dialog.showModal();
  if(onSubmit) $('form',dialog)?.addEventListener('submit',onSubmit);
 }
 function closeModal(){dialog.close();}
 dialog.addEventListener('click',event=>{if(event.target===dialog)closeModal();});
 function demoBanner() {return app.demo?'<div class="demo-banner"><span><strong>Demonstração neste navegador.</strong> Não recebe perguntas de outros celulares.</span><button class="text-button" data-action="demo-panel">Painel de exemplo</button><a href="#/">Sair da demonstração</a></div>':'';}
 function setConnection(ok,message) {document.querySelectorAll('[data-connection]').forEach(el=>{el.className=`status ${ok?'online':'offline'}`;el.textContent=message;});}
 let healthPromise;
 async function health() {
  if(location.protocol==='file:') return {configured:false};
  if(!healthPromise) healthPromise=fetch('api/health',{cache:'no-store',signal:AbortSignal.timeout(6000)}).then(r=>r.json()).catch(()=>({configured:false}));
  return healthPromise;
 }
 async function api(path,options={}) {
  if(app.demo) return demoApi(path,options);
  const headers={'content-type':'application/json'};
  const token=getToken(app.code);if(token)headers.authorization=`Bearer ${token}`;
  let response;
  try {response=await fetch(path.replace(/^\//,''),{method:options.method||'GET',headers,cache:'no-store',body:options.body?JSON.stringify(options.body):undefined,signal:AbortSignal.timeout(12000)});}
  catch {const err=Error('Sem confirmação do servidor. Confira a conexão e tente novamente.');err.network=true;throw err;}
  let result;try {result=await response.json();}catch {throw Error('O recebimento online não está configurado neste endereço. Consulte o guia de configuração.');}
  if(!response.ok){const error=Error(result.error||'Não foi possível concluir.');error.status=response.status;throw error;}
  return result;
 }
 function poster() {return '<div class="poster-wrap"><img class="poster" src="assets/reforma.png" alt="Culto da Reforma, 31 de outubro às 19h, PAES Cabo. Arte com retrato de Martinho Lutero." width="1003" height="1568"><div class="poster-caption"><span>Uma história. Muitas perguntas.</span>Participe da nossa roda de conversa.</div></div>';}
 async function home(version) {
  const connection=await health();if(version!==app.version)return;
  main.innerHTML=`${demoBanner()}<section class="landing"><div class="hero-copy"><div class="eyebrow">31 de outubro · Culto da Reforma</div><h1>A Reforma<br>começa com<br><em>uma pergunta.</em></h1><p class="intro">Fé, história e boas conversas. Traga sua dúvida para a nossa roda de perguntas — seu nome é opcional.</p><div class="entry-card"><h3>Entre na conversa</h3><p>Digite o código que aparece no telão do evento.</p><form id="join-home"><label class="sr-only" for="room-code">Código da sala</label><div class="inline-form"><input id="room-code" class="uppercase" name="code" placeholder="EX.: REFORMA31" maxlength="12" minlength="4" autocomplete="off" autocapitalize="characters" required aria-describedby="entry-error"><button class="btn" type="submit">Entrar ${icon('arrow')}</button></div><p class="form-error" id="entry-error" hidden></p></form><div class="entry-foot">${icon('lock')} Sem cadastro. Perguntas anônimas por padrão.</div></div>${!connection.configured&&!app.demo?'<p class="server-note">O recebimento online ainda não foi ativado. Organização: siga o <a class="text-button" href="ajuda.html">guia de configuração</a>. Você já pode <button class="text-button" data-action="start-demo">explorar a demonstração</button>.</p>':'<p class="server-note"><span class="status online">'+(app.demo?'Demonstração local':'Pronto para receber suas perguntas')+'</span></p>'}</div>${poster()}</section>`;
  $('#join-home').addEventListener('submit',event=>{event.preventDefault();const code=normalCode(new FormData(event.target).get('code'));if(!validCode(code))return formError(event.target,'Use de 4 a 12 letras ou números.');go(`sala/${code}`);});
 }
 function roomHeader(room) {return `<div class="breadcrumb"><a href="${link('')}">Início</a><span>/</span><span>${esc(room.title)}</span></div><div class="page-heading"><div><div class="room-info"><span class="room-code">${esc(room.code)}</span><span class="status ${room.isOpen?'online':'offline'}">${room.isOpen?'Recebendo perguntas':'Recebimento pausado'}</span></div><h1>Qual é a sua pergunta?</h1><p>Sua curiosidade também faz parte deste encontro.</p></div><button class="text-button" data-action="leave-room">Trocar de sala</button></div>`;}
 async function enterRoom(code,version,screen=false) {
  if(!validCode(code))throw Error('Código de sala inválido.');
  app.code=code;
  const data=await api(base(code));if(version!==app.version)return;
  app.room=data.room;
  if(getToken(code)) {
   try {await api(`${base(code)}/screen`);}catch(error){if(error.status===401){saveToken(code,'admin',null);saveToken(code,'guest',null);}else throw error;}
  }
  if(!getToken(code)&&app.room.hasPin){pinPage(screen);return;}
  if(!getToken(code)){const join=await api(`${base(code)}/join`,{method:'POST',body:{}});saveToken(code,'guest',join.token);}
  if(version!==app.version)return;
  screen?await projection(version):participant();
 }
 function pinPage(screen) {
  main.innerHTML=`${demoBanner()}<section class="error-page"><div class="eyebrow">${esc(app.room.title)}</div><h2>Você está quase lá.</h2><p>Esta sala tem uma senha de participação. Peça a senha à organização.</p><div class="card"><form id="pin-form"><label for="pin">Senha de participação</label><input id="pin" type="password" name="pin" maxlength="32" required autocomplete="off"><p class="form-error" hidden></p><button class="btn full" type="submit">Entrar na sala ${icon('arrow')}</button></form></div><a class="text-button" href="${link('')}">Voltar ao início</a></section>`;
  $('#pin-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.target;setBusy(form,true);try{const joined=await api(`${base(app.code)}/join`,{method:'POST',body:{pin:new FormData(form).get('pin')}});saveToken(app.code,'guest',joined.token);app.room=joined.room;screen?await projection(app.version):participant();}catch(error){formError(form,error.message);}finally{setBusy(form,false);}});
 }
 function participant() {
  main.innerHTML=`${demoBanner()}${roomHeader(app.room)}<div class="participant-grid"><section class="card"><div id="sent-notice" hidden class="success-note" tabindex="-1"></div><form id="question-form"><div class="switch-row"><input id="anonymous" name="anonymous" type="checkbox" checked role="switch" aria-describedby="anonymous-help"><label for="anonymous">Enviar anonimamente<small id="anonymous-help">Seu nome não será solicitado nem incluído na pergunta.</small></label></div><div class="field" id="name-field" hidden><label for="display-name">Como você quer se identificar?</label><input id="display-name" name="name" maxlength="60" minlength="2" autocomplete="off" placeholder="Seu primeiro nome ou apelido"></div><div class="field"><label for="question">Sua pergunta</label><textarea class="question-textarea" id="question" name="text" required minlength="8" maxlength="800" placeholder="O que você gostaria de entender sobre a Reforma, a Bíblia ou a fé cristã?" aria-describedby="question-count"></textarea><div class="counter" id="question-count">0 / 800</div></div><p class="form-error" hidden></p><button class="btn full" type="submit" ${app.room.isOpen?'':'disabled'}>${icon('send')} Enviar minha pergunta</button><p class="field-hint">A organização recebe sua pergunta e escolhe o que exibir no telão. Você pode enviar mais de uma.</p></form></section><aside><div class="card"><div class="about-event"><img class="mini-poster" src="assets/reforma.png" alt="Arte do Culto da Reforma" width="90" height="141"><div><div class="eyebrow">Nosso encontro</div><h3>${esc(app.room.title)}</h3><p>31 de outubro · 19h</p><p>PAES Cabo</p></div></div><ol class="steps"><li><div><strong>Pergunte com liberdade</strong><p>Não é preciso criar conta. Identificar-se é opcional.</p></div></li><li><div><strong>Envie para a organização</strong><p>As perguntas chegam ao painel durante o encontro.</p></div></li><li><div><strong>Faça parte da conversa</strong><p>A pergunta selecionada aparece no telão para todos.</p></div></li></ol></div><p class="aside-note">Evite colocar dados pessoais ou o nome de outras pessoas na sua pergunta. No envio anônimo, só o texto é apresentado à organização.</p><div class="connection-line"><span class="status online" data-connection>${app.demo?'Neste navegador':'Conectado à sala'}</span></div></aside></div>`;
  $('#anonymous').addEventListener('change',event=>{const anonymous=event.target.checked;$('#name-field').hidden=anonymous;$('#display-name').required=!anonymous;if(anonymous)$('#display-name').value='';});
  $('#question').addEventListener('input',event=>{$('#question-count').textContent=`${event.target.value.length} / 800`;app.lastSubmission=null;});
  $('#anonymous').addEventListener('change',()=>{app.lastSubmission=null;});
  $('#display-name').addEventListener('input',()=>{app.lastSubmission=null;});
  $('#question-form').addEventListener('submit',submitQuestion);
  const version=app.version;
  poll(async()=>{const data=await api(base(app.code));if(version!==app.version)return;app.room=data.room;const button=$('#question-form button[type=submit]');if(button)button.disabled=!app.room.isOpen;document.querySelectorAll('.room-info .status').forEach(el=>{el.className=`status ${app.room.isOpen?'online':'offline'}`;el.textContent=app.room.isOpen?'Recebendo perguntas':'Recebimento pausado';});},15000);
 }
 async function submitQuestion(event) {
  event.preventDefault();const form=event.target;if(form.getAttribute('aria-busy')==='true')return;
  const text=$('#question').value.trim(),anonymous=$('#anonymous').checked,name=anonymous?null:$('#display-name').value.trim();
  if(text.length<8)return formError(form,'Escreva uma pergunta com pelo menos 8 caracteres.');
  if(!anonymous&&name.length<2)return formError(form,'Informe seu nome ou ative o envio anônimo.');
  setBusy(form,true);$('.form-error',form).hidden=true;
  const fields=[...form.querySelectorAll('input,textarea')];fields.forEach(field=>field.disabled=true);
  if(!app.lastSubmission)app.lastSubmission=uid();
  const version=app.version;
  try {
   await api(`${base(app.code)}/questions`,{method:'POST',body:{text,anonymous,name,submissionId:app.lastSubmission}});
   if(version!==app.version)return;
   app.lastSubmission=null;$('#question').value='';$('#question-count').textContent='0 / 800';
   const notice=$('#sent-notice');notice.textContent=app.demo?'Pergunta adicionada à demonstração deste navegador.':'Pergunta recebida! Obrigado por participar. Você pode enviar outra quando quiser.';notice.hidden=false;notice.focus();
   setConnection(true,app.demo?'Neste navegador':'Recebimento confirmado');
  }catch(error){if(version===app.version){formError(form,error.message);setConnection(false,'Envio não confirmado');}}
  finally{if(version===app.version){fields.forEach(field=>field.disabled=false);setBusy(form,false);if(!app.room.isOpen)$('button[type=submit]',form).disabled=true;}}
 }
 function organizer(tab='login',prefill='') {
  app.formTab=tab;
  main.innerHTML=`${demoBanner()}<section class="auth-layout"><div class="auth-intro"><div class="eyebrow">Nos bastidores do encontro</div><h1>Uma boa conversa<br>começa com<br><em>uma boa escuta.</em></h1><p>Abra sua sala, compartilhe o código e acompanhe as perguntas da igreja em um só lugar.</p><img class="poster" src="assets/reforma.png" alt="Culto da Reforma" width="175" height="274"></div><div class="card"><div class="tabs" role="tablist" aria-label="Acesso da organização"><button role="tab" aria-selected="${tab==='login'}" data-action="auth-tab" data-tab="login">Já tenho uma sala</button><button role="tab" aria-selected="${tab==='create'}" data-action="auth-tab" data-tab="create">Criar sala</button></div><h2>${tab==='create'?'Prepare o encontro.':'Bem-vindo de volta.'}</h2><p class="card-intro">${tab==='create'?'A senha da organização é diferente do código compartilhado com o público.':'Entre no painel para acompanhar e organizar as perguntas.'}</p><form id="organizer-form">${tab==='create'?'<div class="field"><label for="event-title">Nome do encontro</label><input id="event-title" name="title" value="Culto da Reforma" minlength="3" maxlength="80" required></div>':''}<div class="field"><label for="admin-code">Código da sala</label><input class="uppercase" id="admin-code" name="code" placeholder="REFORMA31" value="${esc(prefill)}" minlength="4" maxlength="12" required autocapitalize="characters" autocomplete="off"><p class="field-hint">De 4 a 12 letras ou números, sem espaços.</p></div><div class="field"><label for="admin-password">${tab==='create'?'Crie a senha da organização':'Senha da organização'}</label><div class="password-wrap"><input id="admin-password" type="password" name="password" minlength="8" maxlength="128" required autocomplete="${tab==='create'?'new-password':'current-password'}"><button type="button" data-action="toggle-password" aria-label="Mostrar senha">Mostrar</button></div><p class="field-hint">${app.demo?'Na demonstração: reforma123':tab==='create'?'Use pelo menos 8 caracteres. Guarde a senha: não há recuperação por e-mail.':'Somente a organização deve conhecer esta senha.'}</p></div>${tab==='create'?'<div class="field"><label for="participant-pin">Senha para os participantes <small>opcional</small></label><input id="participant-pin" name="pin" type="password" minlength="4" maxlength="32" autocomplete="new-password" placeholder="Deixe vazio para entrar só pelo código"><p class="field-hint">Se preenchida, compartilhe esta senha com o público.</p></div>':''}<p class="form-error" hidden></p><button type="submit" class="btn full">${tab==='create'?'Criar e abrir minha sala':'Entrar no painel'} ${icon('arrow')}</button></form><p class="aside-note">${app.demo?'Simulação de acesso, sem proteção de produção.':'Participantes não precisam de conta. Para a conversa ao vivo, o banco deve estar conectado.'} <a class="text-button" href="ajuda.html">Ver guia</a></p></div></section>`;
  $('#organizer-form').addEventListener('submit',async event=>{
   event.preventDefault();const form=event.target,data=Object.fromEntries(new FormData(form));data.code=normalCode(data.code);if(!validCode(data.code))return formError(form,'Use um código de 4 a 12 letras ou números.');
   setBusy(form,true);app.code=data.code;
   try{const result=await api(tab==='create'?'/api/rooms':`${base(data.code)}/login`,{method:'POST',body:data});saveToken(data.code,'admin',result.token);app.filter='new';app.page=0;go(`painel/${data.code}`);if(tab==='create')toast('Sala criada. Agora compartilhe o link de participação.');}catch(error){formError(form,error.message);}finally{setBusy(form,false);}
  });
 }
 async function admin(code,version) {
  app.code=code;if(!validCode(code))throw Error('Código de sala inválido.');
  if(!getToken(code,true)){organizer('login',code);return;}
  main.innerHTML=`${demoBanner()}<div class="breadcrumb"><a href="${link('')}">Início</a><span>/</span><span>Organização</span></div><div class="page-heading"><div><div class="room-info"><span class="room-code">${esc(code)}</span><span data-connection class="status">Conectando…</span></div><h1 id="panel-title">Painel do encontro</h1><p>Receba, organize e dê espaço às perguntas.</p></div><div class="page-actions"><button class="btn secondary" data-action="share">${icon('copy')} Convidar participantes</button><button class="btn" data-action="open-screen">${icon('screen')} Abrir telão</button></div></div><div class="admin-stats" id="admin-stats"></div><div class="admin-layout"><section aria-label="Perguntas recebidas"><div class="filter-bar" role="group" aria-label="Filtrar perguntas"><button class="${app.filter==='new'?'active':''}" data-action="filter" data-filter="new">Novas</button><button class="${app.filter==='answered'?'active':''}" data-action="filter" data-filter="answered">Respondidas</button><button class="${app.filter==='archived'?'active':''}" data-action="filter" data-filter="archived">Arquivadas</button><button class="${app.filter==='all'?'active':''}" data-action="filter" data-filter="all">Todas</button></div><div class="questions-list" id="questions-list"><div class="loading"><span class="spinner"></span>Buscando perguntas…</div></div><div id="pagination"></div></section><aside><div class="aside-card"><h3>Compartilhe este código</h3><span class="room-code">${esc(code)}</span><p>O público entra pelo link ou digita este código na página inicial.</p><button class="btn secondary full small" data-action="share">${icon('copy')} Copiar link de entrada</button><button class="btn subtle full small" data-action="guest-preview">Abrir como participante</button></div><div class="aside-card"><h3>Controle do encontro</h3><p id="room-open-note">Atualizando…</p><button class="btn secondary full small" data-action="toggle-room" id="room-toggle">Pausar perguntas</button><button class="btn secondary full small" data-action="clear-feature">Retirar pergunta do telão</button><div class="divider"></div><button class="text-button" data-action="export">Baixar perguntas em JSON</button><br><button class="text-button" data-action="logout">Sair do painel</button><br><button class="text-button" data-action="delete-room">Apagar sala e perguntas</button></div></aside></div>`;
  await refreshAdmin(version);
  if(version===app.version)poll(()=>refreshAdmin(version),3000);
 }
 async function refreshAdmin(version) {
  const data=await api(`${base(app.code)}/questions?status=${app.filter}&offset=${app.page*50}&limit=50`);if(version!==app.version)return;
  app.room=data.room;$('#panel-title').textContent=data.room.title;
  $('#admin-stats').innerHTML=[['Recebidas',data.counts.total],['Aguardando conversa',data.counts.new],['Respondidas',data.counts.answered],['Arquivadas',data.counts.archived]].map(([label,value])=>`<div class="stat"><span>${label}</span><strong>${value}</strong></div>`).join('');
  const html=data.questions.length?data.questions.map(questionCard).join(''):'<div class="empty"><div class="ornament">✦</div><h3>A conversa está aberta.</h3><p>Nenhuma pergunta neste filtro. Compartilhe o código da sala e convide as pessoas a participar.</p></div>';
  const list=$('#questions-list');if(list.innerHTML!==html){const focusId=document.activeElement?.dataset?.id,focusAction=document.activeElement?.dataset?.action;list.innerHTML=html;if(focusId){[...list.querySelectorAll('button')].find(button=>button.dataset.id===focusId&&button.dataset.action===focusAction)?.focus({preventScroll:true});}}
  $('#room-open-note').textContent=data.room.isOpen?'A sala está aberta para novas perguntas.':'Recebimento pausado. As perguntas já recebidas continuam aqui.';
  $('#room-toggle').innerHTML=`${icon(data.room.isOpen?'pause':'play')} ${data.room.isOpen?'Pausar perguntas':'Reabrir perguntas'}`;
  const pages=Math.ceil(data.filteredTotal/50);$('#pagination').innerHTML=pages>1?`<div class="pagination"><button class="btn secondary small" data-action="page" data-delta="-1" ${app.page===0?'disabled':''}>Anterior</button><span>Página ${app.page+1} de ${pages}</span><button class="btn secondary small" data-action="page" data-delta="1" ${app.page+1>=pages?'disabled':''}>Próxima</button></div>`:'';
  setConnection(true,`${app.demo?'Local':'Atualizado'} às ${timeNow()}`);
 }
 function questionCard(q) {
  return `<article class="question-card${q.featured?' featured':''}"><div class="question-meta"><span class="name">${icon(q.name?'person':'lock')} ${esc(q.name||'Pergunta anônima')}${q.featured?'<span class="badge">No telão</span>':''}</span><time datetime="${new Date(q.createdAt).toISOString()}">${dateTime(q.createdAt)}</time></div><p>${esc(q.text)}</p><div class="actions">${q.status==='new'?`<button class="btn ${q.featured?'subtle':'secondary'} small" data-action="feature" data-id="${esc(q.id)}">${icon('screen')} ${q.featured?'No telão':'Exibir no telão'}</button><button class="btn secondary small" data-action="status" data-id="${esc(q.id)}" data-status="answered">${icon('check')} Respondida</button><button class="btn subtle small" data-action="status" data-id="${esc(q.id)}" data-status="archived">Arquivar</button>`:`<span class="status">${q.status==='answered'?'Respondida':'Arquivada'}</span><button class="btn secondary small" data-action="status" data-id="${esc(q.id)}" data-status="new">Voltar para novas</button>`}</div></article>`;
 }
 function poll(task,delay) {
  clearTimeout(app.timer);const version=app.version;let failures=0;
  const run=async()=>{if(version!==app.version)return;if(!document.hidden){try{await task();failures=0;}catch(error){failures++;setConnection(false,error.status===401?'Sessão expirou. Entre novamente.':'Sem atualização · confira a conexão');}}if(version===app.version)app.timer=setTimeout(run,Math.min(30000,delay*Math.max(1,failures)));};
  app.timer=setTimeout(run,delay);
 }
 async function projection(version) {
  document.body.classList.add('screen-mode');
  main.innerHTML=`<section class="projection"><header class="projection-header"><span class="projection-logo">REFORMA <span aria-hidden="true">✦</span></span><div class="projection-controls"><span class="status" data-connection>Conectando…</span><button class="btn secondary small" data-action="fullscreen">Tela cheia</button><a class="btn secondary small" href="${link(`painel/${app.code}`)}">Painel</a></div></header>${demoBanner()}<div class="projection-body" id="projection-content"><div class="loading">Buscando a pergunta selecionada…</div></div><footer class="projection-foot"><span>Envie sua pergunta · código <strong>${esc(app.code)}</strong></span><span>Sola Scriptura · Solus Christus · Soli Deo Gloria</span></footer></section>`;
  const update=async()=>{const result=await api(`${base(app.code)}/screen`);if(version!==app.version)return;const q=result.featured,content=$('#projection-content');const html=q?`<div class="eyebrow">${esc(result.room.title)} · Roda de perguntas</div><div class="projection-question${q.text.length>350?' long':''}">${esc(q.text)}</div><div class="projection-author">${esc(q.name||'Pergunta anônima')}</div>`:`<div class="eyebrow">${esc(result.room.title)}</div><h1>A fé também<br>abre espaço para<br><em>boas perguntas.</em></h1><p class="aside-note">Aguardando a próxima pergunta da organização.</p>`;if(content.innerHTML!==html)content.innerHTML=html;setConnection(true,`Ao vivo · ${timeNow()}`);};
  await update();if(version===app.version)poll(update,3000);
 }
 function shareUrl(route=`sala/${app.code}`) {const url=new URL(location.href);url.hash=`/${route}${suffix()}`;return url.href;}
 async function copyText(text) {
  try{await navigator.clipboard.writeText(text);toast('Link copiado. Compartilhe com os participantes.');return true;}catch{return false;}
 }
 async function share() {
  const url=shareUrl();if(app.demo||location.protocol==='file:') {modal(`<h2>Este é o modo local.</h2><p>O arquivo aberto no computador não recebe perguntas de outros celulares. Para compartilhar com o público, siga o guia e publique a pasta <strong>site</strong> com o banco conectado.</p><a class="btn full" href="ajuda.html">Ver como ativar o modo online</a>`);return;}
  const copied=await copyText(url);modal(`<h2>Convide a igreja.</h2><p>${copied?'Link copiado!':'Copie o endereço abaixo.'} Os participantes abrem o link e já chegam à sala <strong>${esc(app.code)}</strong>.</p><div class="share-url" tabindex="0">${esc(url)}</div><p>${app.room?.hasPin?'Esta sala também exige a senha de participação que você definiu. Compartilhe-a com o público.':'Não é preciso criar conta ou informar uma senha para participar.'}</p><button class="btn full" data-action="close-dialog">Pronto</button>`);
 }
 async function perform(button,task) {if(button.disabled)return;button.disabled=true;try{await task();}catch(error){toast(error.message,true);}finally{if(button.isConnected)button.disabled=false;}}
 document.addEventListener('click',async event=>{
  if(event.target.closest('.skip-link')){event.preventDefault();main.focus();return;}
  const button=event.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;
  if(action==='close-dialog')return closeModal();
  if(action==='help')return modal('<h2>Faça parte da conversa.</h2><ol><li>Abra o link do evento ou digite o código da sala.</li><li>Escreva sua pergunta. O envio anônimo já vem ativado.</li><li>Toque em “Enviar minha pergunta” e aguarde a confirmação.</li></ol><p>A organização recebe as perguntas e escolhe quais serão exibidas no telão. Não há cadastro ou senha pessoal.</p><button class="btn full" data-action="close-dialog">Entendi</button>');
  if(action==='start-demo'){location.hash='/sala/REFORMA31?demo=1';return;}
  if(action==='demo-panel'&&app.demo){const code=app.code||'REFORMA31';saveToken(code,'admin','demo-admin');go(`painel/${code}`);return;}
  if(action==='auth-tab')return organizer(button.dataset.tab,app.code);
  if(action==='toggle-password'){const field=$('#admin-password');field.type=field.type==='password'?'text':'password';button.textContent=field.type==='password'?'Mostrar':'Ocultar';button.setAttribute('aria-label',field.type==='password'?'Mostrar senha':'Ocultar senha');return;}
  if(action==='leave-room'){go('');return;}
  if(action==='share')return share();
  if(action==='open-screen'||action==='guest-preview'){
   const route=action==='open-screen'?'tela':'sala',opened=window.open(shareUrl(`${route}/${app.code}`),'_blank');if(opened)opened.opener=null;else go(`${route}/${app.code}`);return;
  }
  if(action==='fullscreen'){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Este navegador não permitiu tela cheia. Use o modo de apresentação do navegador.',true);}return;}
  if(action==='filter'){app.filter=button.dataset.filter;app.page=0;return admin(app.code,app.version).catch(error=>toast(error.message,true));}
  if(action==='page'){app.page=Math.max(0,app.page+Number(button.dataset.delta));return refreshAdmin(app.version).catch(error=>toast(error.message,true));}
  if(action==='feature')return perform(button,async()=>{await api(`${base(app.code)}/featured`,{method:'PATCH',body:{id:button.dataset.id}});await refreshAdmin(app.version);toast('Pergunta selecionada para o telão.');});
  if(action==='clear-feature')return perform(button,async()=>{await api(`${base(app.code)}/featured`,{method:'PATCH',body:{id:null}});toast('Pergunta retirada do telão.');await refreshAdmin(app.version);});
  if(action==='status')return perform(button,async()=>{await api(`${base(app.code)}/questions/${button.dataset.id}`,{method:'PATCH',body:{status:button.dataset.status}});await refreshAdmin(app.version);});
  if(action==='toggle-room')return perform(button,async()=>{await api(base(app.code),{method:'PATCH',body:{isOpen:!app.room.isOpen}});await refreshAdmin(app.version);});
  if(action==='logout')return perform(button,async()=>{await api(`${base(app.code)}/logout`,{method:'POST',body:{}});saveToken(app.code,'admin',null);go('organizar');});
  if(action==='export')return perform(button,async()=>{const data=await api(`${base(app.code)}/export`);const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`reforma-${app.code.toLowerCase()}-perguntas.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Download das perguntas solicitado ao navegador.');});
  if(action==='delete-room')return modal(`<h2>Apagar este encontro?</h2><p>Isso remove todas as perguntas e encerra os acessos desta sala. Baixe as perguntas antes, se quiser guardá-las. A ação não pode ser desfeita.</p><form id="delete-form"><label for="confirm-code">Digite ${esc(app.code)} para confirmar</label><input id="confirm-code" name="confirmCode" required autocomplete="off"><p class="form-error" hidden></p><div class="modal-actions"><button class="btn danger" type="submit">Apagar sala</button><button class="btn secondary" type="button" data-action="close-dialog">Cancelar</button></div></form>`,async submit=>{submit.preventDefault();const form=submit.target,confirmation=new FormData(form).get('confirmCode');if(confirmation!==app.code)return formError(form,'Digite o código exatamente como aparece acima.');setBusy(form,true);try{await api(base(app.code),{method:'DELETE',body:{confirmCode:confirmation}});saveToken(app.code,'admin',null);saveToken(app.code,'guest',null);closeModal();go('');toast('Sala apagada.');}catch(error){formError(form,error.message);}finally{setBusy(form,false);}});
 });
 async function render() {
  clearTimeout(app.timer);app.timer=null;const version=++app.version;
  const hash=location.hash.slice(1)||'/',[path,query='']=hash.split('?'),params=new URLSearchParams(query);app.demo=params.get('demo')==='1';
  const parts=path.split('/').filter(Boolean),route=parts[0]||'home',code=normalCode(parts[1]||'');
  document.body.classList.remove('screen-mode');$('.brand').href=link('');$('.admin-link').href=link('organizar');
  if(dialog.open)closeModal();
  main.innerHTML='<div class="loading"><span class="spinner" aria-hidden="true"></span>Preparando o encontro…</div>';
  try {
   if(route==='home'||route==='')await home(version);
   else if(route==='organizar'){app.code=code;organizer('login',code);}
   else if(route==='sala')await enterRoom(code,version);
   else if(route==='painel')await admin(code,version);
   else if(route==='tela')await enterRoom(code,version,true);
   else throw Error('Esta página não foi encontrada.');
  }catch(error){if(version===app.version){main.innerHTML=`${demoBanner()}<section class="error-page"><div class="eyebrow">Vamos conferir</div><h2>Não foi possível abrir agora.</h2><p>${esc(error.message)}</p><div class="page-actions"><a class="btn" href="${link('')}">Voltar ao início</a><a class="btn secondary" href="ajuda.html">Guia de configuração</a></div></section>`;}}
  window.scrollTo({top:0,behavior:'instant'});
 }
 window.addEventListener('hashchange',render);
 window.addEventListener('online',()=>setConnection(true,'Conexão voltou · aguardando atualização'));
 window.addEventListener('offline',()=>setConnection(false,'Sem internet · envio indisponível'));
 window.addEventListener('storage',event=>{if(app.demo&&event.key==='reforma-demo-v1'){demoMemory=null;if(location.hash.includes('/painel/'))refreshAdmin(app.version).catch(()=>{});}});

 /* Demonstração isolada: esta parte nunca representa o servidor ao vivo. */
 let demoMemory=null;
 function loadDemo() {
  if(!demoMemory){try{demoMemory=JSON.parse(localStorage.getItem('reforma-demo-v1'));}catch{}}
  if(!demoMemory||!demoMemory.rooms){const now=Date.now();demoMemory={rooms:{REFORMA31:{code:'REFORMA31',title:'Culto da Reforma',isOpen:true,hasPin:false,password:'reforma123',pin:'',featuredId:null,questions:[
   {id:uid(),text:'Por que a Reforma Protestante foi tão importante para a leitura da Bíblia?',name:null,status:'new',createdAt:now-220000},
   {id:uid(),text:'O que significa viver pela fé no nosso dia a dia?',name:null,status:'new',createdAt:now-150000},
   {id:uid(),text:'Como os cinco solas se conectam à vida da igreja hoje?',name:'Participante de exemplo',status:'new',createdAt:now-60000}
  ]}}};saveDemo();}
  return demoMemory;
 }
 function saveDemo(){try{localStorage.setItem('reforma-demo-v1',JSON.stringify(demoMemory));}catch{toast('Demonstração em memória: este navegador não permitiu salvar localmente.',true);}}
 async function demoApi(path,options) {
  const db=loadDemo(),url=new URL(path,'https://demo.invalid'),method=options.method||'GET',body=options.body||{};
  if(url.pathname==='/api/rooms'&&method==='POST'){const code=normalCode(body.code);if(db.rooms[code])throw Error('Este código já existe na demonstração.');db.rooms[code]={code,title:body.title,isOpen:true,hasPin:!!body.pin,pin:body.pin||'',password:body.password,featuredId:null,questions:[]};saveDemo();return {room:db.rooms[code],token:'demo-admin'};}
  const parts=url.pathname.split('/'),code=parts[3],room=db.rooms[code];if(!room)throw Error('Sala não encontrada na demonstração. Use REFORMA31.');
  const tail=parts.slice(4).join('/');
  if(!tail&&method==='GET')return{room};
  if(tail==='login'){if(body.password!==room.password)throw Error('Senha demonstrativa incorreta. Use reforma123 na sala REFORMA31.');return{room,token:'demo-admin'};}
  if(tail==='join'){if(room.pin&&body.pin!==room.pin)throw Error('Senha de participação incorreta.');return{room,token:'demo-guest'};}
  if(tail==='screen')return{room,featured:room.questions.find(q=>q.id===room.featuredId&&q.status==='new')||null};
  if(tail==='questions'&&method==='POST'){if(!room.isOpen)throw Error('O recebimento está pausado.');const existing=room.questions.find(q=>q.submissionId===body.submissionId);if(existing)return{ok:true,id:existing.id};const q={id:uid(),text:body.text,name:body.anonymous?null:body.name,status:'new',createdAt:Date.now(),submissionId:body.submissionId};room.questions.push(q);saveDemo();return{ok:true,id:q.id};}
  if(!getToken(code,true)){const error=Error('Entre como organização para usar esta ação.');error.status=403;throw error;}
  if(tail==='questions'&&method==='GET'){const counts={total:room.questions.length,new:0,answered:0,archived:0};room.questions.forEach(q=>counts[q.status]++);const filter=url.searchParams.get('status')||'all',offset=Number(url.searchParams.get('offset'))||0;const filtered=[...room.questions].reverse().filter(q=>filter==='all'||q.status===filter);return{room,counts,filteredTotal:filtered.length,questions:filtered.slice(offset,offset+50).map(q=>({...q,featured:q.id===room.featuredId}))};}
  if(tail==='export')return{room:{code:room.code,title:room.title},exportedAt:Date.now(),questions:room.questions.map(q=>({text:q.text,name:q.name,status:q.status,createdAt:q.createdAt}))};
  if(tail==='featured'){room.featuredId=body.id;saveDemo();return{ok:true};}
  if(tail.startsWith('questions/')){const q=room.questions.find(q=>q.id===parts[5]);if(!q)throw Error('Pergunta não encontrada.');q.status=body.status;if(room.featuredId===q.id)room.featuredId=null;saveDemo();return{ok:true};}
  if(tail==='logout')return{ok:true};
  if(!tail&&method==='PATCH'){room.isOpen=body.isOpen;saveDemo();return{ok:true};}
  if(!tail&&method==='DELETE'){if(body.confirmCode!==code)throw Error('Confirmação incorreta.');delete db.rooms[code];saveDemo();return{ok:true};}
  throw Error('Ação não disponível na demonstração.');
 }
 render();
})();
