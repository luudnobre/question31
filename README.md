# Reforma — perguntas do encontro

Aplicativo feito para o Culto da Reforma, com a arte fornecida por você. Interface em HTML, CSS e JavaScript puro; um pequeno Worker com banco D1 permite que celulares diferentes enviem perguntas ao mesmo painel.

**Comece abrindo `COMECE-AQUI.html`.** O site não foi publicado. O ZIP não inclui nenhuma conta, senha administrativa pré-definida, token ou banco de produção.

## Para explorar agora

1. Extraia o ZIP.
2. Abra `site/index.html` no navegador.
3. Clique em **explorar a demonstração**.
4. Use a sala `REFORMA31`. Para experimentar o painel, abra **Organização**, use o mesmo código e a senha fictícia `reforma123`.

Esta demonstração guarda somente exemplos e alterações neste navegador. Não recebe perguntas de outros aparelhos. Navegadores que bloqueiam armazenamento em arquivos locais mantêm a demonstração apenas em memória.

## Para usar no evento com vários celulares

Não basta subir HTML em uma hospedagem estática qualquer: as perguntas precisam chegar a um banco compartilhado. A versão online já está implementada em `site/_worker.js`, para Cloudflare Pages com D1.

1. Na sua conta Cloudflare, escolha o plano gratuito disponível e crie um banco **D1**, por exemplo `reforma-perguntas`.
2. Em **Workers & Pages**, crie um projeto **Pages** por upload direto. Envie **o conteúdo da pasta `site`**, com `index.html` e `_worker.js` na raiz do upload. Não envie o ZIP inteiro com a pasta `site` aninhada.
3. No projeto Pages, em **Settings / Configurações → Bindings / Vinculações**, adicione um banco **D1**. O nome da variável precisa ser exatamente **`DB`**. Selecione o banco criado.
4. Faça um **novo deploy** da mesma pasta `site` depois de adicionar a vinculação. Em instalações que exibam ambientes separados, configure **Production / Produção**.
5. Abra o endereço do projeto no navegador. O Worker cria suas tabelas automaticamente no primeiro acesso. A página inicial deve mostrar **Pronto para receber suas perguntas**. Se continuar indisponível, abra `SEU-ENDERECO/api/health`: o resultado esperado é `{"configured":true,"mode":"online"}`.
6. Vá em **Organização → Criar sala**. Sugestão de código: `REFORMA31`. Defina e guarde uma senha exclusiva da organização. A senha de participação é opcional; deixe vazia para o público entrar somente pelo link ou código.
7. No painel, clique em **Convidar participantes** e distribua o link. Quem abrir o link já entra na sala, sem cadastro. Também é possível abrir a página inicial e digitar o código.
8. Abra **Telão** em uma segunda aba ou na tela do projetor. No painel, **Exibir no telão** seleciona a pergunta da vez.

Não há build, npm ou terminal para publicar por este caminho. Nenhuma biblioteca é carregada de CDN. Não é necessário comprar domínio. Os nomes dos menus podem variar; o requisito técnico é **Pages com Worker em modo avançado e binding D1 chamado DB**.

O código não exige serviços pagos. A disponibilidade do plano gratuito e suas cotas dependem do provedor; confira as condições no painel antes do evento. Não habilite recursos pagos se não desejar despesas. Atualização automática consome requisições e leituras do banco. Não houve publicação ou validação em uma conta Cloudflare nesta entrega.

## O que funciona

- Entrada por código e link direto, sem cadastro do participante.
- Senha opcional para participação e senha separada para a organização.
- Perguntas anônimas por padrão; nome/apelido opcional quando o anonimato é desativado.
- No envio anônimo, um nome eventualmente digitado antes é descartado no navegador e no servidor.
- Painel com atualização a cada aproximadamente **3 segundos**, enquanto a aba está visível e a conexão funciona; o formulário confere a abertura da sala a cada 15 segundos.
- Filtros por novas, respondidas, arquivadas e todas; paginação de 50 perguntas.
- Seleção para o telão, retirada, resposta, arquivamento e restauração.
- Pausar e reabrir recebimento.
- Download das perguntas em JSON e exclusão da sala mediante confirmação.
- O público não acessa a fila privada de perguntas: o telão mostra somente a pergunta escolhida.
- Confirmação de envio somente após resposta do servidor. Repetir uma tentativa com o mesmo identificador não duplica a pergunta.
- Layout adaptado por CSS para celular, tablet, computador e projeção.

## Uso e limites

- É necessário acesso à internet no celular e no computador da organização. O público não precisa estar na mesma rede Wi-Fi.
- No máximo **2.000 perguntas por sala**, **800 caracteres por pergunta** e 10 envios por minuto por sessão. O limite de criação é de 8 salas por hora por IP; login administrativo tem limite de tentativas. Para centenas de participantes na mesma rede, as entradas normais têm limite mais amplo.
- Sessões duram 16 horas. Reabrir um navegador sem a sessão pode exigir código/senha novamente. A senha da organização é escolhida na criação; não existe recuperação por e-mail nesta versão.
- O anonimato é perante a interface e a organização: não se exige conta ou nome. Não prometa anonimato absoluto de infraestrutura: o provedor processa requisições e pode manter metadados técnicos. O aplicativo usa identificadores de sessão e hashes em limites de tentativas. Não registra IP bruto no banco nem inclui conteúdo em logs do código.
- Os textos enviados podem conter informações que a própria pessoa digitar. Evite incentivar informações pessoais. Somente perguntas selecionadas ficam visíveis no telão.
- A proteção do painel é verificada no servidor. Senhas são derivadas com PBKDF2, salt próprio e 100.000 iterações. Tokens de acesso são aleatórios, expiram e são guardados como hash no banco; no navegador ficam em `sessionStorage` quando disponível. Não há senha da organização no JavaScript público.
- Não há WhatsApp, e-mail, pagamento, sorteio de prêmios ou integração externa obrigatória no navegador. “Baixar perguntas” não envia mensagens.
- Os registros permanecem no D1 até a organização apagar a sala. Exporte antes, se desejar. A exclusão feita pelo aplicativo não controla backups ou logs eventualmente retidos pelo provedor.
- Depois do evento, pause a sala, baixe as perguntas se necessário e apague a sala quando não quiser mais manter os registros.

## Arquivos

```text
site/                 ← publique esta pasta
  index.html
  style.css
  script.js
  _worker.js          ← API e controle de acesso no servidor
  ajuda.html
  assets/
COMECE-AQUI.html        ← instruções para abrir no navegador
README.md
schema.sql             ← referência; criação automática pelo Worker
package.json           ← somente desenvolvimento opcional
tools/                 ← servidor local e adaptador SQLite
tests/                 ← testes do backend
```

Para editar os textos, use `site/script.js`. Para cores e layout, `site/style.css`. A arte está em `site/assets/reforma.png`, sem alterações em relação ao anexo.

## Desenvolvimento opcional

Para quem quiser testar a versão com servidor local: requer Node.js **24**. Não há pacotes para instalar.

```sh
node tools/dev-server.mjs
node --test tests/*.test.mjs
```

Abra `http://localhost:3000`, crie uma sala e use outra aba para participar. O banco local é criado em `.local/reforma.sqlite`; essa pasta não faz parte da entrega. O servidor de desenvolvimento não é a hospedagem de produção e não deve ser exposto diretamente à internet.

## Validação desta entrega

Testes executados com Node.js 24 e SQLite local usando o mesmo código do Worker: envio, anonimato do nome, controle do painel no servidor, isolamento entre salas, senha de participação, autenticação, expiração, repetição de envio, seleção e remoção do telão, resposta, arquivamento, pausa, exportação, exclusão, limites, origem e modo sem banco. Conferência adicional da interface no navegador registrada em `VALIDACAO.md`.

Limite da verificação: o adaptador local usa SQLite, mas não substitui uma verificação após publicar no ambiente real D1/Pages. Antes do evento, faça um envio do seu celular e confirme a chegada no painel do computador. Não use apenas a demonstração como teste da conexão ao vivo.

Documentação oficial para consulta: [Pages em modo avançado](https://developers.cloudflare.com/pages/functions/advanced-mode/), [vinculações Pages](https://developers.cloudflare.com/pages/functions/bindings/), [D1](https://developers.cloudflare.com/d1/), [cotas D1](https://developers.cloudflare.com/d1/platform/pricing/). A consulta online a essas páginas não esteve disponível durante esta execução; confira os menus e as condições atuais no provedor.
