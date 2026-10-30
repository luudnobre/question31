# Validação — 30/10/2026

## Executado

- `node --check site/script.js` e `node --check site/_worker.js`: sem erros de sintaxe.
- `node --test tests/*.test.mjs`: **8 testes passaram, 0 falharam**.
- Testes usam o código real do Worker com adaptador SQLite em Node.js 24. Testam ações e autorização no servidor, não apenas botões ocultos.
- No navegador: página inicial, formulário, confirmação de envio, painel e telão conferidos visualmente.
- Na demonstração: uma pergunta foi enviada, apareceu no painel e uma pergunta foi selecionada e exibida no telão.
- Uma pergunta contendo `<b>Teste de texto</b>` apareceu como texto literal. O elemento do texto teve zero elementos filhos; não foi interpretado como HTML.
- Fora da demonstração: o navegador entrou em uma sala de teste do servidor local e enviou uma pergunta. A interface confirmou o recebimento após a API responder. Consulta independente no SQLite confirmou **1 pergunta gravada e 0 nomes identificados** naquela sala.
- Conferidos os textos e links do guia `site/ajuda.html` no navegador.

## Limites da verificação

- A versão não foi publicada no Cloudflare Pages; não houve teste em uma conta D1 real. O adaptador local não reproduz cotas, latência ou todas as particularidades do serviço.
- O layout tem regras de adaptação para celular e tablet, mas não houve ensaio em aparelho físico ou em emulação de viewport móvel nesta execução. A conferência visual ocorreu em navegador de computador.
- Não houve ensaio de carga com centenas de participantes ou teste de conectividade na igreja.
- O modo de demonstração não verifica envio entre dispositivos. Faça um teste no celular e no computador depois de publicar.
- A documentação pública do provedor não pôde ser consultada pelo serviço de pesquisa nesta execução; as referências oficiais estão no README para conferência dos menus, limites e condições atuais.

Os exemplos da sessão de testes e o banco local `.local/reforma.sqlite` não integram o ZIP. A versão publicada começa sem salas e sem perguntas.
