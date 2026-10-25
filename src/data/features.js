// Registro único do estado de cada recurso. A interface usa esta lista
// para rotular o que é funcional, demonstrativo ou planejado, e a tela
// "Recursos" a exibe por completo.

export const STATUS = {
  real: { label: 'Funcional', description: 'Funciona de verdade nesta versão, com as limitações indicadas.' },
  demo: { label: 'Demonstração', description: 'Simulação para avaliar a experiência. Não executa a ação real.' },
  planned: { label: 'Planejado', description: 'Ainda não implementado. Previsto para uma fase futura.' },
};

export const FEATURES = [
  { id: 'ui', name: 'Interface para iPad (claro/escuro, letras grandes)', status: 'real', phase: 1 },
  { id: 'assistant-choice', name: 'Escolha de assistente feminina ou masculino', status: 'real', phase: 1 },
  { id: 'text-chat', name: 'Conversa por texto', status: 'real', phase: 1, detail: 'Motor local por regras: entende comandos como lista de compras, lembretes e horário. Não é uma IA generativa.' },
  { id: 'ai-chat', name: 'Conversa com IA generativa (Claude)', status: 'demo', phase: 2, detail: 'Opcional e desligada por padrão. Só funciona quando o app é aberto como Artifact no claude.ai.', dependency: 'Claude (claude.ai). Em produção exigirá API com custo por uso.' },
  { id: 'voice-out', name: 'Voz da assistente (fala em português)', status: 'real', phase: 2, detail: 'Usa as vozes instaladas no aparelho (síntese do navegador). A naturalidade depende do sistema.' },
  { id: 'voice-in', name: 'Microfone (reconhecimento de fala)', status: 'real', phase: 2, detail: 'Usa o reconhecimento de fala do Safari. Exige HTTPS e permissão. Bloqueado dentro do Artifact.', dependency: 'Serviço de reconhecimento de fala da Apple, acionado pelo Safari.' },
  { id: 'conversation-mode', name: 'Modo conversa (sem tocar a cada frase)', status: 'real', phase: 2, detail: 'Depois de responder, a assistente volta a ouvir. Encerra com "pode parar", "tchau" ou após silêncio. Exige https; validar no iPad.' },
  { id: 'wake-word', name: 'Chamar a assistente pelo nome', status: 'real', phase: 2, detail: 'Opcional e desligado por padrão. Só na tela principal e com o app aberto. O áudio passa pelo reconhecimento de fala da Apple o tempo todo.', dependency: 'Reconhecimento de fala da Apple, acionado pelo Safari.' },
  { id: 'avatar', name: 'Personagem 3D realista com sincronização labial', status: 'real', phase: 2, detail: 'Rosto em 3D (modelos Microsoft Rocketbox, licença MIT) que pisca, respira, olha para a pessoa e mexe a boca junto com a voz. A boca é calculada a partir do texto falado, então a sincronia é aproximada. É um personagem virtual, não uma pessoa real. Em aparelhos sem WebGL, volta para a ilustração.' },
  { id: 'avatar-real', name: 'Avatar fotorrealista em vídeo', status: 'planned', phase: 2, dependency: 'Serviço externo pago de avatar em vídeo (HeyGen, D-ID, Simli e similares), só com sua autorização.' },
  { id: 'residents', name: 'Cadastro de moradores, familiares e visitantes', status: 'real', phase: 3, detail: 'Dados salvos apenas neste navegador.' },
  { id: 'memory', name: 'Memória individual (consultar, corrigir, excluir)', status: 'real', phase: 3, detail: 'Guarda só o que o morador pede ou cadastra. Conversas completas não são salvas.' },
  { id: 'manual-id', name: 'Identificação manual de quem está falando', status: 'real', phase: 3, detail: 'O morador escolhe o próprio nome. Fica registrado no histórico de identificação.' },
  { id: 'face-id', name: 'Reconhecimento facial consentido', status: 'planned', phase: 4, detail: 'Desativado. Só será ativado com consentimento e validação.' },
  { id: 'voice-id', name: 'Reconhecimento de voz consentido', status: 'planned', phase: 4, detail: 'Desativado. Só será ativado com consentimento e validação.' },
  { id: 'reminders', name: 'Lembretes', status: 'real', phase: 5, detail: 'Avisam na tela e por voz somente enquanto o app está aberto.' },
  { id: 'routines', name: 'Rotinas (bom dia, boa noite, mensagens)', status: 'real', phase: 5, detail: 'A assistente só fala sozinha nos horários que o morador ativar, e só com o app aberto.' },
  { id: 'keep-awake', name: 'Manter a tela ligada', status: 'real', phase: 5, detail: 'Usa o bloqueio de tela do Safari (iPadOS 16.4 ou mais recente). Desligado por padrão.' },
  { id: 'push', name: 'Notificações com o app fechado', status: 'planned', phase: 5, dependency: 'Servidor de notificações (Web Push).' },
  { id: 'shopping', name: 'Lista de compras', status: 'real', phase: 5 },
  { id: 'sos', name: 'Botão SOS', status: 'demo', phase: 5, detail: 'Mostra os números de emergência e os contatos. Não envia alertas a ninguém nesta versão.' },
  { id: 'alerts', name: 'Alertas para familiares com confirmação e escalonamento', status: 'planned', phase: 5, dependency: 'Backend + serviço de SMS, push ou WhatsApp.' },
  { id: 'calls', name: 'Chamadas para familiares', status: 'planned', phase: 5 },
  { id: 'ipad-camera', name: 'Teste da câmera frontal do iPad', status: 'real', phase: 4, detail: 'Somente pré-visualização local, sem gravação e sem análise. Exige HTTPS e permissão.' },
  { id: 'ip-cameras', name: 'Câmeras IP (RTSP/ONVIF)', status: 'planned', phase: 6, detail: 'Cadastro já disponível; conexão real ainda não existe.', dependency: 'Central local ou servidor para converter o vídeo.' },
  { id: 'fall', name: 'Detecção de possíveis quedas', status: 'planned', phase: 6, detail: 'Será um módulo validado separadamente e nunca o único mecanismo de emergência.' },
  { id: 'saas', name: 'Contas, assinaturas e painel administrativo', status: 'planned', phase: 7, detail: 'Modelo de dados já separa cliente, residência e moradores.' },
  { id: 'central', name: 'Central humana de monitoramento 24h', status: 'planned', phase: 8 },
];

export function feature(id) {
  return FEATURES.find((f) => f.id === id);
}
