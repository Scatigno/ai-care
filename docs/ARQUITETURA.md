# Arquitetura — AI Care v0.1

## Visão geral

Aplicação web de página única, sem framework, escrita em JavaScript moderno
(módulos ES). Roda inteira no navegador: não há backend nesta fase. O código
é organizado em camadas para que cada uma possa ser trocada sem reescrever as
outras quando o produto ganhar servidor, contas e dispositivos.

```
┌──────────────────────────── ui/ ─────────────────────────────┐
│ app.js (casca, roteador, cabeçalho, SOS sempre visível)      │
│ views/*  telas      components/*  avatar, modal, formulários │
└───────────────┬───────────────────────────────┬──────────────┘
                │ ctx (store, speech, ui, navigate, say, toast)
┌───────────────▼──────────┐   ┌────────────────▼──────────────┐
│ services/                │   │ domain/                        │
│ speech (Web Speech API)  │   │ regras puras sobre o estado:   │
│ camera (getUserMedia)    │   │ residents, memory, reminders,  │
│ scheduler (lembretes)    │   │ shopping, devices, emergency   │
│ conversation/engine      │──▶│                                │
│ conversation/claude      │   └────────────────┬──────────────┘
└──────────────────────────┘                    │
┌───────────────────────────────────────────────▼──────────────┐
│ core/store  estado único, update() com clone + persistência   │
│ core/storage  adaptador: localStorage (hoje) → API (Fase 7)   │
│ data/schema  modelo multi-tenant, migração   data/seed  fictício│
└───────────────────────────────────────────────────────────────┘
```

## Modelo de dados (multi-tenant desde o início)

```
tenant (cliente/assinante)
 └─ households[] (residências)  ← tenantId
     ├─ residents[]  (morador | familiar | visitante)  ← householdId
     │    ├─ memories[]            ← residentId
     │    └─ identificationLog[]   ← residentId
     ├─ reminders[]  (opcionalmente de um residente)
     ├─ shopping[]
     ├─ devices[]    (ipad-camera | ip-rtsp | onvif | sensor)
     ├─ alerts[]     (acionamentos de SOS; delivered=false nesta versão)
     └─ audit[]      (registro de alterações)
session: { householdId, activeResidentId }
settings: tema, fonte, assistente, voz, provedor de conversa
```

Toda leitura passa por `scoped(state, coleção)`, que filtra pela residência
ativa. Toda escrita no domínio confere o `householdId`. No backend da Fase 7
esse filtro vira regra obrigatória no servidor (row-level security), e o
cliente deixa de ter acesso a outras residências.

## Fluxo de uma mensagem

1. A pessoa fala (Safari converte a fala em texto) ou digita.
2. `conversation/engine.respond()` identifica a intenção por regras em
   português (texto normalizado sem acentos; datas e horas por
   `timeparse.js`).
3. Se a intenção gera mudança, o efeito é aplicado com `store.update()`
   (ex.: adicionar item, criar lembrete, guardar memória).
4. A resposta aparece na conversa e é falada pela síntese de voz, com a boca
   do avatar animada enquanto fala.
5. Intenção desconhecida: resposta honesta do motor local, ou, se o usuário
   ligou a IA experimental e o app está no claude.ai, a pergunta vai ao Claude
   com instruções de segurança e as memórias autorizadas da pessoa ativa.

A conversa fica só em memória (máx. 60 mensagens) e some ao fechar o app.

## Pontos de extensão previstos

| Ponto | Hoje | Futuro |
|---|---|---|
| `core/storage` | localStorage | API REST/GraphQL com autenticação |
| `conversation/claudeProvider` | `window.claude` do Artifact | backend próprio com LLM e controle de custo por cliente |
| `components/avatar3d` + `services/lipsync` | personagem 3D (three.js, Rocketbox) com visemas calculados do texto | avatar fotorrealista em vídeo (serviço externo) ou visemas vindos do áudio da voz neural |
| `components/avatar` | SVG ilustrado (reserva sem WebGL) | — |
| `services/speech` | Web Speech API | STT/TTS em nuvem com voz neural pt-BR |
| `domain/devices` | cadastro sem conexão | central local (RTSP/ONVIF → WebRTC/HLS) |
| `domain/emergency` | registro local | serviço de alertas com confirmação e escalonamento |
| `data/features` | lista estática | flags por plano de assinatura |

## Compatibilidade

- Alvo: Safari no iPadOS 17+ (iPad Pro 12,9" 6ª geração: 1024×1366 pt).
- Build: esbuild com alvo `safari15`.
- Layout: trilho lateral acima de 900 px; barra inferior abaixo disso. A tela
  principal fica lado a lado na horizontal e empilhada na vertical.
- Microfone e câmera exigem contexto seguro (https). O app detecta e explica
  quando não estão disponíveis, em vez de falhar.
- O Safari suspende páginas em segundo plano: lembretes só avisam com o app
  aberto. Não há monitoramento contínuo.
