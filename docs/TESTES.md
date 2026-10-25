# Testes

## Automatizados

| Comando | O que cobre | Resultado em 25/10/2026 |
|---|---|---|
| `npm test` | 53 testes de unidade: interpretação de datas e horas, intenções do motor de conversa, lista de compras, lembretes (vencimento, repetição, disparo único), memórias, moradores (validação, exclusão em cascata), isolamento por residência, SOS como não enviado, migração de dados, registro de recursos, rotinas (horário, janela de 2 h, dias da semana, mensagem de bom dia/boa noite), modo conversa e chamada pelo nome (ciclo ouvir/esperar/ouvir, silêncio, despedida, permissão negada, reinício da escuta contínua), sincronização labial em português (ç, ch, lh, nh, qu, rr, l final, h mudo, pausas, velocidade da fala) | 53/53 (fuso de São Paulo e UTC) |
| `npm run e2e` | 23 cenários no Chromium (WebGL por software), em 1366×1024, 1024×1366 e 400×860: configuração inicial, conversa, compras, lembretes, memórias, cadastro com validação, troca de pessoa, exclusão, SOS, emergência por texto, aviso de lembrete, microfone indisponível, câmera com confirmação, dispositivo externo nunca "conectado", rotinas com autorização e disparo no horário, manter tela ligada, tema, persistência, ausência de rolagem horizontal, modo conversa e chamada pelo nome com reconhecimento de fala simulado, avatar 3D (carrega, mexe a boca durante a fala simulada, fecha a boca no fim, troca de personagem, desliga para a ilustração) e aparelho sem WebGL, e ausência de erros de JavaScript | 23/23 (código-fonte e build) |

Capturas de tela do teste ficam em `test-results/`.

## Limites conhecidos dos testes

- O motor do Safari (WebKit) não está disponível no ambiente de
  desenvolvimento; os testes usam Chromium. É preciso validar no iPad real.
- Microfone, câmera e vozes em português não existem no navegador de teste;
  os testes confirmam que o app explica a indisponibilidade sem quebrar.
- A IA experimental (Claude) não é testada automaticamente.
- O desempenho do avatar 3D (fluidez, bateria, aquecimento) só pode ser
  avaliado no iPad real.

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
10. Modo conversa: tocar uma vez no microfone e fazer três pedidos seguidos sem
    tocar de novo; dizer "tchau" para encerrar.
11. Avatar 3D: conferir se a boca acompanha a voz, se pisca e se a tela fica
    fluida por 10 minutos; conferir o aquecimento do iPad.
