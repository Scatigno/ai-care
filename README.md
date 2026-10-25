# AI Care

Assistente residencial inteligente. Protótipo web (v0.1.0) para testes no
Safari do iPad Pro 12,9" (6ª geração), com dados fictícios.

> O AI Care não substitui cuidadores, profissionais de saúde nem serviços de
> emergência. Nesta versão, o botão SOS **não envia alertas** a ninguém.

## O que esta versão faz

| Recurso | Situação |
|---|---|
| Interface para iPad, modo claro/escuro, texto ampliável | Funcional |
| Escolha de assistente feminina ou masculino, com nome personalizável | Funcional |
| Conversa por texto (motor local por regras, em português) | Funcional |
| Fala da assistente (vozes do aparelho) | Funcional |
| Microfone (reconhecimento de fala do Safari) | Funcional, exige https |
| Moradores, familiares e visitantes; memória individual | Funcional (dados no navegador) |
| Lembretes com aviso na tela e por voz | Funcional com o app aberto |
| Lista de compras | Funcional |
| Rotinas de bom dia, boa noite e mensagens, autorizadas pelo morador | Funcional com o app aberto |
| Manter a tela ligada (iPad como central na sala) | Funcional (iPadOS 16.4+) |
| Teste da câmera frontal (sem gravação nem análise) | Funcional, exige https |
| Avatar | Demonstração: ilustração animada provisória |
| Botão SOS | Demonstração: mostra números e contatos, não envia nada |
| Conversa com IA generativa (Claude) | Demonstração opcional, só no Artifact |
| Avatar realista, biometria, câmeras IP, alertas, SaaS | Planejado |

A lista completa fica em `src/data/features.js` e aparece no app em
**Menu › O que já funciona**.

## Como executar

Requer Node.js 18 ou mais recente.

```bash
npm install          # instala o esbuild (única dependência, só para build)
npm run serve        # abre o código-fonte em http://localhost:5173
npm test             # testes de unidade
npm run build        # gera dist/web (PWA) e dist/artifact (arquivo único)
npm run e2e          # teste de ponta a ponta (precisa do Playwright)
npm run e2e -- dist  # mesmo teste sobre o build
```

### Testar no iPad

- **Pelo Artifact (mais simples):** abra o link do Artifact no Safari do iPad,
  com sua conta do claude.ai. Funciona tudo, exceto microfone e câmera, que o
  claude.ai bloqueia dentro de Artifacts.
- **Com microfone e câmera:** o Safari só libera microfone e câmera em
  endereço `https://`. É preciso hospedar `dist/web` em um serviço com https
  (por exemplo GitHub Pages ou Cloudflare Pages, ambos gratuitos). Isso
  publica o app na internet e depende da autorização do proprietário.
- Pela rede local (`http://IP-do-computador:5173`) o app abre, mas o Safari
  bloqueia microfone e câmera por não ser https.

Para instalar como app (PWA): Safari › Compartilhar › Adicionar à Tela de Início
(na versão hospedada).

## Estrutura

```
index.html            página de desenvolvimento (carrega src/ direto, sem build)
sw.js                 service worker (cache offline da versão hospedada)
public/               manifesto PWA e ícones
src/
  main.js             ponto de entrada
  core/               utilitários: DOM, estado (store), persistência, formatos
  data/               modelo de dados, migração, dados fictícios, registro de recursos
  domain/             regras de negócio puras: moradores, memória, lembretes, compras, dispositivos, emergência
  services/           voz, câmera, agendador de lembretes, tema, conversa (motor local + IA opcional)
  ui/                 casca do app, componentes e telas
  styles/app.css      estilos e tokens de tema
tests/unit/           testes de unidade (node:test)
tests/e2e/smoke.mjs   teste de ponta a ponta (Playwright/Chromium)
docs/                 arquitetura, planejamento, decisões, progresso e testes
```

## Documentação

- [Arquitetura](docs/ARQUITETURA.md)
- [Planejamento e tarefas](docs/PLANEJAMENTO.md)
- [Decisões técnicas](docs/DECISOES.md)
- [Registro de progresso](docs/PROGRESSO.md)
- [Testes](docs/TESTES.md)
