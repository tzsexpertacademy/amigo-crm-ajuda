const { PromptMessageQueue, DelayPromptQueue } = require("../../services/WbotServices/SendPromptV2/PromptMessageQueue");

const delayPromptHandler = async (job) => {
  const { body, ticketId, companyId, promptKey, msgData, contactId, promptId } = job.data;

  console.log(`⏳ [DELAY] - Delay concluído. Verificando prioridade para o ticket: ${ticketId}`);

  try {
    // 🔎 Busca todos os jobs ativos, em espera ou com delay para o mesmo ticket
    const delayJobs = await DelayPromptQueue.getJobs(["waiting", "delayed", "active"]);

    // 🔍 Filtra os jobs com o mesmo ticketId
    const sameTicketJobs = delayJobs.filter((existingJob) => existingJob.data.ticketId === ticketId);

    // 🔎 Verifica o job mais antigo com base no timestamp de criação
    const oldestJob = sameTicketJobs.reduce((oldest, current) => {
      return oldest.timestamp < current.timestamp ? oldest : current;
    }, job);

    // ⚠️ Se este job NÃO for o mais antigo, cancela o reenvio
    if (oldestJob.id !== job.id) {
      console.log(`🚫 [VALIDAÇÃO] - Este job (ID: ${job.id}) NÃO é o mais antigo. Cancelando reenvio para PromptMessageQueue.`);
      return;
    }

    // ✅ Se for o mais antigo, envia para PromptMessageQueue
    console.log(`✅ [VALIDAÇÃO] - Este job (ID: ${job.id}) é o mais antigo. Reenviando para PromptMessageQueue.`);
    await PromptMessageQueue.add(
      "SendPrompt",
      {
        body,
        ticketId,
        companyId,
        promptKey,
        msgData,
        contactId,
        promptId,
        skipDelay: true, // 🚀 Indica que não deve mais esperar
      },
      {
        removeOnComplete: true,
      }
    );

    console.log(`📨 [REENVIO] - Job reenviado para PromptMessageQueue | Ticket: ${ticketId}`);
  } catch (error) {
    console.error(`❌ [ERROR] - Erro ao verificar prioridade do job (ID: ${job.id}) | Erro: ${error.message}`);
  }
};

module.exports = { delayPromptHandler };
