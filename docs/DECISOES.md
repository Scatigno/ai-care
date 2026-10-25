# Decisões técnicas

Formato: contexto curto, decisão, consequência. Datas em horário de Brasília.

## D-001 · Web sem framework, módulos ES (25/10/2026)
Protótipo precisa rodar no Safari do iPad sem instalação e sem custo.
**Decisão:** HTML/CSS/JS puros com módulos ES; esbuild só para gerar o build.
**Consequência:** zero dependências em produção, carregamento rápido, fácil de
auditar. Se a interface crescer muito, migrar para um framework (ex.: Preact)
é localizado na camada `ui/`.

## D-002 · Estado único com persistência plugável (25/10/2026)
**Decisão:** `core/store` com `update(mutator)` sobre um clone e um adaptador
de armazenamento (`load/save/clear`). Hoje localStorage.
**Consequência:** trocar por API na Fase 7 exige um novo adaptador e
sincronização, sem mudar telas nem regras.

## D-003 · Modelo multi-tenant desde a v0.1 (25/10/2026)
**Decisão:** toda entidade carrega `householdId`; residência carrega `tenantId`;
leituras usam `scoped()`.
**Consequência:** a plataforma SaaS não exige migrar o formato dos dados.
O isolamento real (segurança) só existirá com backend.

## D-004 · Avatar ilustrado provisório (25/10/2026)
Avatar humano realista com sincronização labial depende de serviço externo
pago (ex.: provedores de avatar em tempo real) ou de modelo próprio.
**Decisão:** usar uma ilustração SVG com piscar, respiração e boca animada
durante a fala, rotulada como "Avatar ilustrado provisório".
**Consequência:** a experiência pode ser testada sem custo. A escolha do
serviço realista fica para a Fase 2, com estimativa de custo por cliente antes
de contratar. *Substituída em parte pela D-013.*

## D-005 · Motor de conversa local por regras (25/10/2026)
**Decisão:** intenções em português por regras (compras, lembretes, memória,
hora, data, identificação, emergência). Sem IA generativa por padrão.
**Consequência:** funciona offline, sem custo e sem enviar dados. Entende só o
que foi programado e diz isso com clareza quando não entende.

## D-006 · Biometria desligada e não coletada (25/10/2026)
**Decisão:** nenhum cadastro nasce com reconhecimento facial ou de voz; o
formulário mostra o recurso como desativado; nenhuma foto ou amostra de voz é
coletada. A identificação é manual (a pessoa escolhe o nome).
**Consequência:** atende à regra do projeto e à LGPD (dado sensível, art. 11).
A Fase 4 precisa de termo de consentimento, validação e exclusão.

## D-007 · Conversas não são gravadas (25/10/2026)
**Decisão:** a conversa existe só na memória da página. Só vira dado salvo o
que a pessoa pede ("lembre que…") ou cadastra.
**Consequência:** menos risco de privacidade; a assistente não "lembra" da
conversa de ontem, só das memórias explícitas.

## D-008 · SOS honesto (25/10/2026)
**Decisão:** o SOS abre um painel com 192/193/190 e os contatos de emergência,
diz em destaque que nada foi enviado e registra o acionamento com
`delivered: false`.
**Consequência:** nenhuma pessoa é levada a crer que houve aviso. O envio real
exige backend e serviço de mensagens (Fase 5) e só será ativado depois de
testes de entrega.

## D-009 · IA generativa opcional via Artifact (25/10/2026)
No claude.ai, Artifacts podem chamar o Claude com permissão do usuário, sem
contratar serviço.
**Decisão:** provedor "IA Claude (experimental)", desligado por padrão, usado
só para perguntas que o motor local não entende, com instruções de segurança
(sem orientação médica, sem fingir ações, sem inferir emoções).
**Consequência:** permite avaliar conversa fluida no protótipo. Em produção,
substituir por backend próprio com orçamento por cliente.

## D-010 · Tipografia e cores para pessoas idosas (25/10/2026)
**Decisão:** Atkinson Hyperlegible (texto) e Lexend (títulos); base de 18 px
com opção de 115% e 130%; alvos de toque de 56 px ou mais; contraste alto nos
dois temas; hover só em aparelhos com mouse.
**Consequência:** fontes vêm do Google Fonts; sem internet, caem para fontes
do sistema.

## D-011 · Distribuição para testes (25/10/2026)
**Decisão:** gerar um arquivo único para Artifact privado no claude.ai (não é
público) e uma pasta `dist/web` pronta para hospedagem com https.
**Consequência:** o proprietário testa no iPad sem publicar nada. Microfone e
câmera só funcionarão quando ele autorizar uma hospedagem https.

## D-012 · Conversa por voz contínua e chamada pelo nome (25/10/2026)
O proprietário pediu para não precisar apertar o botão a cada frase.
**Decisão:** modo conversa ligado por padrão (um toque abre uma conversa que
continua até despedida, toque ou silêncio) e chamada pelo nome opcional,
desligada por padrão, com aviso de privacidade antes de ligar. O microfone
nunca fica aberto enquanto a assistente fala.
**Consequência:** com a chamada pelo nome ligada, o áudio da sala passa pelo
reconhecimento de fala da Apple mesmo quando ninguém chama; por isso exige
confirmação e mantém o indicador "Microfone ativo" aceso.

## D-013 · Personagem 3D gratuito antes de avatar pago (25/10/2026)
O proprietário escolheu "3D realista gratuito primeiro".
**Decisão:** usar modelos Microsoft Rocketbox (licença MIT), que já trazem
formas faciais de fala (visemas), piscar e expressões, desenhados com
three.js no próprio iPad. A boca é calculada do texto em português e
reajustada a cada palavra anunciada pela voz do Safari. Ready Player Me foi
descartado (serviço encerrado). Modelos convertidos para GLB compacto
(meshopt) com só 27 formas faciais; ferramentas em `scripts/avatar/`.
**Consequência:** sem custo e sem enviar nada para fora do aparelho. A
aparência é de personagem de jogo, não de vídeo; o rótulo deixa claro que é
um personagem virtual. Avatar fotorrealista em vídeo continua planejado e só
será contratado com autorização (N09).

