# Planejamento técnico

Legenda: ✅ concluída · 🔶 parcial · ⬜ não iniciada · 🔒 depende de autorização ou serviço externo

## Fases

| Fase | Objetivo | Situação |
|---|---|---|
| 1 | Estrutura inicial e interface web | ✅ |
| 2 | Avatares e conversação por voz | 🔶 voz do navegador e avatar ilustrado; avatar realista 🔒 |
| 3 | Moradores e memória individual | ✅ local; sincronização depende da Fase 7 |
| 4 | Câmera do iPad e identificação consentida | 🔶 teste de câmera; biometria 🔒 consentimento e validação |
| 5 | Alertas e assistência | 🔶 lembretes e compras; alertas reais 🔒 backend |
| 6 | Câmeras externas e sensores | ⬜ cadastro pronto; conexão 🔒 central local |
| 7 | Plataforma SaaS | ⬜ modelo de dados pronto |
| 8 | Central humana 24h | ⬜ |

## Tarefas da primeira entrega

| # | Tarefa | Depende de | Situação |
|---|---|---|---|
| T01 | Estrutura do projeto, build e servidor local | — | ✅ |
| T02 | Estado central e persistência plugável | T01 | ✅ |
| T03 | Modelo multi-tenant, migração e dados fictícios | T02 | ✅ |
| T04 | Registro de recursos (funcional/demonstração/planejado) | T01 | ✅ |
| T05 | Tokens de tema claro/escuro, tipografia, componentes base | T01 | ✅ |
| T06 | Casca: cabeçalho, SOS fixo, navegação lateral/inferior, roteador | T05 | ✅ |
| T07 | Configuração inicial e escolha de assistente | T06, T09 | ✅ |
| T08 | Motor de conversa local e interpretação de datas | T03 | ✅ |
| T09 | Avatar ilustrado com animação de fala | T05 | ✅ |
| T10 | Tela principal: avatar, conversa, microfone, resumo do dia | T08, T09, T11 | ✅ |
| T11 | Serviço de voz (reconhecimento + síntese) | T01 | ✅ |
| T12 | Moradores: cadastro, edição, exclusão, permissões, identificação manual | T03 | ✅ |
| T13 | Memórias por pessoa (consultar, corrigir, excluir) | T12 | ✅ |
| T14 | Lembretes e agendador com aviso na tela | T03 | ✅ |
| T15 | Lista de compras | T03 | ✅ |
| T16 | Câmeras: teste consentido e cadastro de dispositivos | T03 | ✅ |
| T17 | Emergência: painel SOS, contatos, histórico | T12 | ✅ |
| T18 | Configurações, privacidade, exportação e auditoria | T06 | ✅ |
| T19 | Testes de unidade e de ponta a ponta | T08–T18 | ✅ |
| T20 | Build para Artifact e para hospedagem PWA | T01 | ✅ |
| T21 | Documentação | — | ✅ |

## Próximas tarefas (sem custo, podem seguir sem autorização)

| # | Tarefa | Depende de |
|---|---|---|
| N01 | Teste manual no iPad real e correções de Safari | proprietário abrir o link |
| N02 | ✅ Rotinas autorizadas: bom dia, boa noite, mensagem personalizada | T14 |
| N03 | Agenda/compromissos com visão semanal | T14 |
| N04 | ✅ Modo "tela sempre ligada" (Wake Lock) para uso como central na sala | T10 |
| N05 | Contatos familiares com atalho de chamada (FaceTime/telefone) | T12 |
| N06 | Mais intenções no motor local (clima sem rede: explicar; conversa social) | T08 |
| N07 | Exportar/importar dados em arquivo | T18 |
| N08 | Especificação da API e do backend (Fase 7) | — |
| N09 | Estudo comparativo de serviços de avatar realista e voz neural, com custo por cliente | — |

## Tarefas que precisam de autorização

| Tarefa | Motivo |
|---|---|
| Hospedar `dist/web` em https (GitHub Pages ou similar) | publica o app; necessário para microfone e câmera no iPad |
| Repositório no GitHub | o proprietário precisa criar e informar o nome |
| Avatar realista e voz neural | serviço pago |
| IA generativa em produção | serviço pago por uso |
| Envio real de alertas (SMS, WhatsApp, push) | serviço pago e risco à segurança de pessoas |
| Biometria | dado sensível; exige consentimento, validação e termo |
