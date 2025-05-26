const axios = require("axios");
const exportedFunctions = require("../../services/WbotServices/OpenaiFunctions");
const ShowTicketService =
  require("../../services/TicketServices/ShowTicketService").default;
const {
  CheckRunStatusQueue
} = require("../../services/WbotServices/SendPromptV2/PromptMessageQueue");
const socket = require("../../workers/socket"); // Importa o cliente Socket.IO

const requiresActionHandler = async job => {
  const {
    threadId,
    runId,
    requiredAction,
    ticketId,
    companyId,
    promptKey,
    msgData,
    contactId,
    contactName,
    promptId
  } = job.data;

  try {
    console.log(
      `🔴 [RequiresAction] Processando ação requerida para Run ID: ${runId}`
    );

    const realTicket = await ShowTicketService(ticketId, companyId);

    const toolCalls = requiredAction?.submit_tool_outputs?.tool_calls;

    if (toolCalls?.length) {
      console.log(
        `🔎 [RequiresAction] Encontradas ${toolCalls.length} tool calls.`
      );


      const toolOutputs = await Promise.all(
        toolCalls.map(async toolCall => {
          const functionName = toolCall?.function?.name;
          const args = toolCall?.function?.arguments;

          console.log(`⚙️ [RequiresAction] Executando função: ${functionName}`);

          if (functionName && functionName in exportedFunctions) {

            console.log("REAL TICKET: ", JSON.stringify(realTicket, null, 2));

            try {
              const result = await exportedFunctions[functionName](
                JSON.parse(args || "{}"),
                {
                  ticketId: realTicket.id,
                  queue: realTicket.queue,
                  queueId: realTicket.queueId,
                  companyId: realTicket.companyId,
                  contactId: realTicket.contactId,
                  userId: realTicket.userId,
                  phoneNumber: realTicket.contact.number ?? "",
                  name: realTicket.contact.name
                }
              );

              console.log(
                `✅ [RequiresAction] Resultado da função ${functionName}:`,
                result
              );
          

              return {
                tool_call_id: toolCall.id,
                output: result
              };
            } catch (error) {
              console.error(
                `❌ [RequiresAction] Erro na execução da função ${functionName}:`,
                error.message
              );
              throw error;
            }
          } else {
            console.error(
              `❌ [RequiresAction] Função ${functionName} não encontrada.`
            );
            throw new Error(`Function ${functionName} not found.`);
          }
        })
      );

      console.log(`📤 [RequiresAction] Enviando resultados para a OpenAI...`);
      console.log(
        `https://api.openai.com/v1/threads/${threadId}/runs/${runId}/submit_tool_outputs`,
        "TOOL CALL API"
      );
      await axios.post(
        `https://api.openai.com/v1/threads/${threadId}/runs/${runId}/submit_tool_outputs`,
        { tool_outputs: toolOutputs, stream: true },
        {
          headers: {
            authorization: `Bearer ${promptKey}`,
            "OpenAI-Beta": "assistants=v2"
          }
        }
      );
      console.log(`📤 [RequiresAction] Dados enviados`);

      console.log(
        `📤 [RequiresAction] Movendo para a fila de CheckRunStatusQueue`
      );

      await CheckRunStatusQueue.add(
        "CheckRunStatus",
        {
          ticketId,
          companyId,
          promptKey,
          threadId,
          runId,
          msgData,
          contactId,
          promptId
        },
        {
          removeOnComplete: true
        }
      );

      console.log(`✅ [RequiresAction] Tool outputs enviados com sucesso!`);
    } else {
      console.error(`❌ [RequiresAction] Nenhuma tool call encontrada.`);
    }
  } catch (error) {
    console.error(
      `❌ [RequiresAction] Erro ao processar action:`,
      error.message
    );
    throw error;
  }
};

module.exports = { requiresActionHandler };
