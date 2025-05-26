const axios = require("axios");
const ShowTicketService = require("../../services/TicketServices/ShowTicketService").default;
const UpdateTicketService = require("../../services/TicketServices/UpdateTicketService").default;
const GetWhatsappWbot = require("../../helpers/GetWhatsappWbot").default;
const { DelayPromptQueue, CheckRunStatusQueue } = require("../../services/WbotServices/SendPromptV2/PromptMessageQueue");
const ShowPromptService = require("../../services/PromptServices/ShowPromptService").default;
const ShowContactService = require("../../services/ContactServices/ShowContactService").default;

function parseToken(tokenString) {
  const BLOCK_DELIMITER = "||--||";
  const TOKEN_KEYS = {
    ASSISTANT: "assistant",
    QUEUE_KEY: "queue-key",
    VOICE: "voice",
    USE_DELAY: "use-delay",
    ASSISTANT_MODE: "assistant-mode",
  };

  if (!tokenString.includes(BLOCK_DELIMITER)) {
    return null;
  }

  const tokens = tokenString.split(BLOCK_DELIMITER);
  const data = {
    assistant: null,
    relations: [],
    voice: null,
    useDelay: null,
    assistantMode: null,
  };

  tokens.forEach((token) => {
    const [key, value] = token.split(":");
    if (key === TOKEN_KEYS.ASSISTANT) data.assistant = value?.trim();
    else if (key.startsWith(TOKEN_KEYS.QUEUE_KEY)) {
      const [queue, keyValue] = value.split("-");
      data.relations.push({ queue: queue?.trim(), key: keyValue?.trim() });
    } else if (key === TOKEN_KEYS.VOICE) data.voice = value?.trim();
    else if (key === TOKEN_KEYS.USE_DELAY) data.useDelay = value?.trim();
    else if (key === TOKEN_KEYS.ASSISTANT_MODE) data.assistantMode = value?.trim();
  });

  return data;
}

const sendPromptJobHandler = async (job) => {
  const { body, ticketId, companyId, promptKey, msgData, contactId, promptId, skipDelay } = job.data;

  console.log(`🔄 [JOB START] - Iniciando processamento do job ID: ${job.id} | Ticket: ${ticketId}`);

  try {
    console.log("🔎 [STEP 1] - Buscando ticket...");
    const realTicket = await ShowTicketService(ticketId, companyId);
    console.log(`✅ [STEP 1] - Ticket encontrado: ${realTicket.id}`);

    console.log("🔎 [STEP 2] - Buscando contato...");
    const contact = await ShowContactService(contactId, companyId);
    console.log(`✅ [STEP 2] - Contato encontrado: ${contact.id}`);

    console.log("🔎 [STEP 3] - Buscando prompt...");
    const prompt = await ShowPromptService({ promptId, companyId });
    console.log(`✅ [STEP 3] - Prompt encontrado: ${prompt.id}`);

    // console.log("🔎 [STEP 4] - Buscando instância do WhatsApp...");
    // const wbot = await GetWhatsappWbot(realTicket.whatsapp);
    // console.log(`✅ [STEP 4] - Instância WhatsApp: ${wbot?.user?.id || "Não encontrado"}`);

    let threadId = realTicket.threadId;

    if (!threadId) {
      console.log("📝 [STEP 5] - Criando novo thread na OpenAI...");
      const { data } = await axios.post(
        `https://api.openai.com/v1/threads`,
        {},
        {
          headers: {
            authorization: `Bearer ${promptKey}`,
            "OpenAI-Beta": "assistants=v2",
          },
        }
      );
      threadId = data.id;
      await realTicket.update({ threadId });
      console.log(`✅ [STEP 5] - Novo thread criado: ${threadId}`);
    }

    if (realTicket.status !== "open") {
      console.log("🛠️ [STEP 6] - Atualizando status do ticket...");
      await UpdateTicketService({
        ticketData: { queueId: realTicket?.queue?.id, useIntegration: false, promptId: null, status: "open" },
        ticketId: ticketId,
        companyId: companyId,
      });
      console.log("✅ [STEP 6] - Status do ticket atualizado para 'open'.");
    }

    const payload = {
      role: "user",
      content: Array.isArray(body) ? body : [{ type: "text", text: body }],
    };

    console.log("📨 [STEP 7] - Enviando mensagem para o thread...");
    await axios.post(
      `https://api.openai.com/v1/threads/${threadId}/messages`,
      payload,
      {
        headers: {
          authorization: `Bearer ${promptKey}`,
          "OpenAI-Beta": "assistants=v2",
        },
      }
    );
    console.log("✅ [STEP 7] - Mensagem enviada para a thread.");

    const delayJobs = await DelayPromptQueue.getJobs(["waiting", "delayed", "active"]);

    for (const existingJob of delayJobs) {
      if (existingJob.data.ticketId === ticketId) {
        console.log(`❌ [STEP 7.5] - Removendo job duplicado na DelayPromptQueue (ID: ${existingJob.id})`);
        await existingJob.remove();
      }
    }

    if (!skipDelay) {
      console.log("⏳ [STEP 8] - Adicionando job à DelayPromptQueue...");
      await DelayPromptQueue.add(
        "DelayPrompt",
        {
          body,
          ticketId,
          companyId,
          promptKey,
          msgData,
          contactId,
          promptId,
          skipDelay: true,
        },
        { delay: 4000, removeOnComplete: true }
      );
      return;
    }

    console.log("⚙️ [STEP 9] - Iniciando o run...");
    const parsedKeys = parseToken(prompt.prompt);
    const newPromptKey = parsedKeys ? parsedKeys.assistant : prompt.prompt;

    const runResponse = await axios.post(
      `https://api.openai.com/v1/threads/${threadId}/runs`,
      { assistant_id: newPromptKey },
      {
        headers: {
          authorization: `Bearer ${promptKey}`,
          "OpenAI-Beta": "assistants=v2",
        },
      }
    );

    const runId = runResponse.data.id;

    console.log(`✅ [STEP 10] - Run iniciado. ID do run: ${runId}`);
    console.log("🔄 [STEP 11] - Adicionando à CheckRunStatusQueue...");

    await CheckRunStatusQueue.add("CheckRunStatus", {
      ticketId,
      companyId,
      promptKey,
      threadId,
      runId,
      msgData,
      contactId,
      promptId,
    });

    console.log("✅ [STEP 11] - Job adicionado à CheckRunStatusQueue com sucesso.");
  } catch (error) {
    console.error(`❌ [ERROR] - Erro no job ID: ${job.id} | Erro: ${error.message}`);
    throw error;
  }
};

module.exports = { sendPromptJobHandler };
