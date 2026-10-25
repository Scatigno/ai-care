# Registro de progresso

Última atualização: 25/10/2026 · versão 0.1.0

## Funcionalidades concluídas

- Tela inicial com identidade AI Care e configuração inicial em 3 passos.
- Escolha entre assistente feminina (Clara) e masculino (Rafael), com nome
  personalizável e troca em Configurações.
- Tela principal com avatar ilustrado animado, conversa, microfone grande,
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
- 28 testes de unidade e 18 cenários de ponta a ponta passando.

## Em desenvolvimento

- Nada em andamento. Próxima prioridade: validação no iPad real (N01) e
  rotinas personalizadas (N02).

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

## Problemas conhecidos

- Microfone e câmera não funcionam dentro do Artifact do claude.ai (bloqueio
  da plataforma) nem em `http://` na rede local (exigência do Safari).
- Lembretes não avisam com o app fechado ou com o iPad bloqueado.
- A qualidade da voz depende das vozes instaladas no iPad.
- Ainda não testado no Safari/WebKit real.

## Próximas tarefas

Ver [PLANEJAMENTO.md](PLANEJAMENTO.md#próximas-tarefas-sem-custo-podem-seguir-sem-autorização).

## Dependências externas

| Dependência | Uso | Custo | Situação |
|---|---|---|---|
| Google Fonts | tipografia | gratuito | em uso (sem internet usa fontes do sistema) |
| Reconhecimento de fala do Safari (Apple) | microfone | gratuito | em uso, exige https |
| Vozes do iPadOS | fala da assistente | gratuito | em uso |
| Claude (claude.ai, via Artifact) | IA experimental opcional | incluso no plano do usuário | opcional, desligado por padrão |
| Hospedagem https | microfone/câmera no iPad | gratuito (GitHub Pages) | aguarda autorização |
| Serviço de avatar realista | Fase 2 | pago | não contratado |
| Voz neural / STT em nuvem | Fase 2 | pago | não contratado |
| SMS/WhatsApp/push | alertas da Fase 5 | pago | não contratado |
| Backend + banco | Fase 7 | pago | não contratado |
