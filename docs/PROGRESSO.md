# Registro de progresso

Última atualização: 25/10/2026 · versão 0.2.1

## Funcionalidades concluídas

- Tela inicial com identidade AI Care e configuração inicial em 3 passos.
- Escolha entre assistente feminina (Clara) e masculino (Rafael), com nome
  personalizável e troca em Configurações.
- Tela principal com avatar, conversa, microfone grande,
  sugestões de comandos, hora, próximo lembrete e lista de compras.
- Botão SOS sempre visível no topo, com painel honesto (nada é enviado).
- Menu de funcionalidades com o status de cada uma.
- Moradores, familiares e visitantes: cadastro, edição, exclusão em cascata,
  permissões registradas, contato de emergência, confirmação de dados fictícios.
- Identificação manual de quem está usando, com histórico.
- Memória individual por pessoa, por categoria; criar por conversa
  ("lembre que…"), corrigir e apagar ("esqueça que…").
- Lembretes: criação por formulário ou conversa, repetição diária/semanal,
  aviso na tela e por voz, adiar 10 minutos.
- Lista de compras por conversa ou formulário.
- Câmeras: teste consentido da câmera frontal (sem gravação) e cadastro de
  dispositivos, sempre marcados como não conectados.
- Emergência: números 192/193/190, contatos e histórico de acionamentos.
- Configurações: tema claro/escuro/automático, tamanho do texto, voz, provedor
  de conversa, ver dados (JSON), auditoria, restaurar exemplos, apagar tudo.
- Tela "O que já funciona" com funcional/demonstração/planejado.
- Build para Artifact (arquivo único) e para hospedagem PWA.
- Rotinas autorizadas pelo morador: bom dia (lembretes do dia e compras),
  boa noite (lembretes de amanhã) e mensagem personalizada, com dias da semana,
  autorização obrigatória e exemplo que nasce desligado.
- Opção "Manter a tela ligada" (Screen Wake Lock), desligada por padrão.
- Modo conversa por voz: um toque no microfone e a assistente ouve, responde
  e volta a ouvir sozinha; encerra com "pode parar"/"tchau", novo toque ou
  dois silêncios seguidos. O microfone fecha enquanto ela fala.
- Chamada pelo nome ("Clara, …"), opcional e desligada por padrão, com aviso
  de privacidade antes de ligar e indicador "Microfone ativo" aceso.
- Personagem 3D realista (v0.2.0): modelos Microsoft Rocketbox (MIT), uma
  mulher e um homem, com pele, cabelo e roupas texturizados; pisca, respira,
  mexe a cabeça e o olhar, muda a expressão ao ouvir e ao pensar, e mexe a
  boca junto com a fala (15 visemas calculados do texto em português e
  reajustados a cada palavra que o Safari anuncia). Carrega sob demanda
  (≈ 0,6 MB de código + ≈ 1,1 MB por personagem), mostra um retrato enquanto
  carrega e volta para a ilustração em aparelhos sem WebGL. Pode ser
  desligado em Configurações. Rotulado "Personagem virtual em 3D · não é uma
  pessoa real".
- v0.2.1 (após o primeiro teste no iPad): botão "Mãos livres" na tela
  principal (chamar pelo nome sem tocar, com confirmação de privacidade);
  voz espera o microfone fechar antes de falar e tenta de novo se não
  começar; voz liberada no primeiro toque; conversa tolera 3 silêncios;
  motor local responde a conversa social ("tudo bem?", "está me ouvindo?",
  "repete", "fala mais devagar", piada, tempo, "você é real?").
- 54 testes de unidade e 23 cenários de ponta a ponta passando.

## Em desenvolvimento

- Publicado em https://scatigno.github.io/ai-care/ (GitHub Pages, publicação automática a cada push na `main`). Aguarda o teste no iPad.
- Próxima prioridade: validação no iPad real (N01), comparativo de custos de
  avatar fotorrealista pago (N09), agenda semanal (N03) e contatos (N05).

## Problemas encontrados e corrigidos

| Data | Problema | Correção |
|---|---|---|
| 25/10 | Indicadores "Microfone ativo"/"Câmera ativa" apareciam desligados (CSS sobrepunha `hidden`) | regra global `[hidden]` |
| 25/10 | Vários itens da navegação ficavam destacados ao mesmo tempo (`classList.toggle` com `undefined`) | condição booleana explícita |
| 25/10 | Página 11 px mais larga que a tela no celular (barra inferior) | colunas `minmax(0, 1fr)` e rótulos com reticências |
| 25/10 | Destaque de "hover" grudava após toque | hover só em `@media (hover: hover)` |
| 25/10 | Coluna do avatar cortava o resumo do dia no iPad horizontal | avatar proporcional à altura e cartões lado a lado |
| 25/10 | Cartões do resumo esticavam na vertical no iPad em retrato | `align-content: start` |
| 25/10 | Dados do cadastro quebravam palavras ("Desativad a") | fatos em linhas rótulo/valor |
| 25/10 | Status dizia "Pronta" para o assistente masculino | texto conforme o gênero |
| 25/10 | Resumo da rotina deixava nomes próprios em minúsculas ("marcos") | só a primeira letra do lembrete vira minúscula |
| 25/10 | Lembrete de exemplo já vencido abria aviso por cima da configuração inicial | exemplos nascem no futuro e o agendador espera o fim da configuração |
| 25/10 | Modo conversa parava de ouvir quando a resposta saía antes de a escuta fechar | volta a ouvir ao fim da escuta se a resposta já terminou |
| 25/10 | No iPad, a resposta aparecia mas a fala ficava em "Pensando…" logo depois do microfone | fala espera 450 ms após fechar o microfone e tenta de novo se não começar |
| 25/10 | Avatar 3D vinha de braços abertos (pose técnica do modelo) | braços abaixados ao carregar, com rotação no eixo do mundo |

## Problemas conhecidos

- Microfone e câmera não funcionam dentro do Artifact do claude.ai (bloqueio
  da plataforma) nem em `http://` na rede local (exigência do Safari).
- Lembretes não avisam com o app fechado ou com o iPad bloqueado.
- A qualidade da voz depende das vozes instaladas no iPad.
- Ainda não testado no Safari/WebKit real.
- A boca do avatar 3D é sincronizada pelo texto, não pelo áudio: pode
  adiantar ou atrasar um pouco quando a voz do iPad muda de ritmo.
- O avatar 3D é realista, mas não fotorrealista (qualidade de jogo, não de
  vídeo). Fotorrealismo exige serviço pago (ver N09).

## Próximas tarefas

Ver [PLANEJAMENTO.md](PLANEJAMENTO.md#próximas-tarefas-sem-custo-podem-seguir-sem-autorização).

## Dependências externas

| Dependência | Uso | Custo | Situação |
|---|---|---|---|
| Google Fonts | tipografia | gratuito | em uso (sem internet usa fontes do sistema) |
| Reconhecimento de fala do Safari (Apple) | microfone | gratuito | em uso, exige https |
| Vozes do iPadOS | fala da assistente | gratuito | em uso |
| Claude (claude.ai, via Artifact) | IA experimental opcional | incluso no plano do usuário | opcional, desligado por padrão |
| Hospedagem https | microfone/câmera no iPad | gratuito (GitHub Pages) | em uso: https://scatigno.github.io/ai-care/ |
| Microsoft Rocketbox (modelos 3D) | personagem 3D | gratuito, licença MIT | em uso, embutido no app |
| three.js | desenho 3D (WebGL) | gratuito, licença MIT | em uso, embutido no app |
| Serviço de avatar fotorrealista em vídeo | opcional | pago | não contratado |
| Voz neural / STT em nuvem | Fase 2 | pago | não contratado |
| SMS/WhatsApp/push | alertas da Fase 5 | pago | não contratado |
| Backend + banco | Fase 7 | pago | não contratado |
