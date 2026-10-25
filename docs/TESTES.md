# Testes

## Automatizados

| Comando | O que cobre | Resultado em 25/10/2026 |
|---|---|---|
| `npm test` | 33 testes de unidade: interpretação de datas e horas, intenções do motor de conversa, lista de compras, lembretes (vencimento, repetição, disparo único), memórias, moradores (validação, exclusão em cascata), isolamento por residência, SOS como não enviado, migração de dados, registro de recursos, rotinas (horário, janela de 2 h, dias da semana, mensagem de bom dia/boa noite) | 33/33 (fuso de São Paulo e UTC) |
| `npm run e2e` | 20 cenários no Chromium, em 1366×1024, 1024×1366 e 400×860: configuração inicial, conversa, compras, lembretes, memórias, cadastro com validação, troca de pessoa, exclusão, SOS, emergência por texto, aviso de lembrete, microfone indisponível, câmera com confirmação, dispositivo externo nunca "conectado", rotinas com autorização e disparo no horário, manter tela ligada, tema, persistência, ausência de rolagem horizontal e de erros de JavaScript | 20/20 (código-fonte e build) |

Capturas de tela do teste ficam em `test-results/`.

## Limites conhecidos dos testes

- O motor do Safari (WebKit) não está disponível no ambiente de
  desenvolvimento; os testes usam Chromium. É preciso validar no iPad real.
- Microfone, câmera e vozes em português não existem no navegador de teste;
  os testes confirmam que o app explica a indisponibilidade sem quebrar.
- A IA experimental (Claude) não é testada automaticamente.

## Roteiro manual no iPad (Safari)

1. Abrir o link e concluir a configuração inicial escolhendo cada assistente.
2. Girar o iPad: conferir layout na horizontal e na vertical.
3. Tocar em "Testar a voz" em Configurações; ajustar velocidade.
4. Digitar "adicione leite na lista", "me lembre de beber água daqui a 2 minutos".
5. Aguardar o aviso do lembrete na tela e ouvir a fala.
6. Cadastrar um morador fictício, trocar quem está usando, criar e apagar memória.
7. Tocar no SOS: conferir o aviso "Nenhum alerta foi enviado".
8. Alternar claro/escuro e tamanho do texto.
9. Na versão https: microfone (falar um comando) e câmera (ligar e desligar).
