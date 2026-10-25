# Avatar realista: visual da Clara e opções fotorrealistas (N09)

Última atualização: 25/10/2026

## Pedido

O proprietário enviou uma imagem de referência (mulher de cabelo escuro com
pontas acobreadas, óculos de armação vinho, blusa preta de gola alta, fundo
escuro com luz verde-azulada e âmbar) e pediu "a agente desse jeito".

## Direitos da imagem de referência

- A imagem traz a marca d'água "CapCut · AI". Não dá para saber se é um rosto
  inteiramente gerado por IA ou um efeito aplicado sobre a foto de uma pessoa
  real.
- Os termos do CapCut dão à própria CapCut uma licença ampla sobre o conteúdo
  enviado e tratam os materiais da plataforma por um contrato à parte que pode
  não permitir uso comercial ([resumo dos termos](https://studiol7.substack.com/p/who-really-owns-your-edits-what-capcuts)).
- Se for o rosto de uma pessoa real, usar a imagem num produto comercial exige
  autorização dela (direito de imagem, Código Civil art. 20) e é dado pessoal
  pela LGPD.

**Decisão:** não copiar o rosto da referência. A Clara virou uma personagem
original *no estilo* da referência. Para um avatar fotorrealista pago, o rosto
deve vir de (a) um avatar de banco do próprio fornecedor com licença
comercial, ou (b) uma imagem criada do zero por descrição em texto, numa
ferramenta cuja licença permita uso comercial, sem foto de pessoa real como
base.

## O que foi feito agora (gratuito, já no app)

Personagem 3D "Clara" (base Microsoft Rocketbox Female_Adult_08, licença MIT):

- cabelo longo escuro na raiz e acobreado nas pontas (cor por vértice);
- óculos de acetato vinho modelados no app, presos à cabeça;
- blusa preta de malha com gola alta e mangas compridas;
- olhos castanhos, batom rosado, sorriso suave em repouso;
- fundo de estúdio escuro e luz de recorte verde-azulada e âmbar.

Continua com sincronização labial pelo texto em português, piscar, respiração
e olhar. **Limite honesto:** é um personagem 3D de jogo, não um vídeo
fotorrealista. O rótulo "Personagem virtual em 3D · não é uma pessoa real"
continua na tela.

## Opções fotorrealistas (vídeo gerado em tempo real)

Todas exigem conta, chave de API e um pequeno servidor para guardar a chave
(o app hoje não tem backend). Preços públicos lidos em agosto e setembro de
2026; confirmar na contratação.

| Opção | Como funciona | Preço por minuto de vídeo | Rosto próprio | Observações |
|---|---|---|---|---|
| **Simli** | só o rosto: recebe o áudio da nossa voz e devolve o vídeo com a boca sincronizada (~150 ms) | US$ 0,005 a 0,01 ([simli.com](https://www.simli.com/)); 50 min grátis por mês | a partir de uma foto | precisa de voz neural em português à parte; mais barato de longe |
| **HeyGen LiveAvatar** | rosto + voz + IA, ou só o rosto | ≈ US$ 0,08–0,10 (Lite) e ≈ US$ 0,16–0,19 (Full) ([liveavatar.com](https://www.liveavatar.com/), [índice Akapulu](https://blog.akapulu.com/p/real-time-avatar-api-pricing-index/)) | 1 incluso no plano de US$ 99/mês | plano grátis tem marca d'água e sessões de 2 min |
| **Anam** | rosto + voz + IA | US$ 0,11–0,16 ([índice Akapulu](https://blog.akapulu.com/p/real-time-avatar-api-pricing-index/)) | incluso nos planos pagos | 30 min grátis por mês |
| **Tavus** | conversa em vídeo completa | US$ 0,26–0,35 ([tavus.io/pricing](https://www.tavus.io/pricing)) | 1 a 15 conforme o plano | mais caro; 42+ idiomas |
| **D-ID** | agentes com vídeo | sob consulta | sim | preço não público |
| **Local (LivePortrait, MuseTalk e similares)** | modelo aberto rodando numa central na casa | sem mensalidade | sim | exige computador com placa de vídeo (GPU) ligado na casa; não roda no iPad. Encaixa na Fase 6 (central local) |

### Custo estimado por cliente (só o vídeo do avatar)

| Uso com o avatar na tela | Simli | LiveAvatar Lite | Anam | Tavus |
|---|---|---|---|---|
| 30 min/dia (900 min/mês) | ≈ US$ 5–9 | ≈ US$ 70–90 | ≈ US$ 100–145 | ≈ US$ 235–315 |
| 2 h/dia (3.600 min/mês) | ≈ US$ 18–36 | ≈ US$ 285–340 | ≈ US$ 400–575 | ≈ US$ 935–1.260 |

A voz neural em português (Simli) e a IA de conversa (todas) entram à parte.
Para uma assinatura mensal acessível, só a Simli (ou a central local) cabe
com folga; as outras pedem cobrar só o tempo de fala ou limitar minutos.

## Recomendação

1. Manter a Clara 3D gratuita como padrão e como reserva sem internet.
2. Fazer uma prova de conceito com a **Simli** no plano grátis (50 min/mês):
   rosto original criado por texto, voz neural pt-BR e um servidor gratuito
   (por exemplo Cloudflare Workers) para guardar a chave. Só começa com a
   autorização do proprietário (cadastro em serviço externo).
3. Avaliar a central local com GPU na Fase 6, se o volume de uso justificar.
