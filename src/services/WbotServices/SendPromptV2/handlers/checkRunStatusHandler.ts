import axios from "axios";
import { RequiresActionQueue, SendMessageQueue } from "../PromptMessageQueue";
import ShowTicketService from "../../../TicketServices/ShowTicketService";
import parseToken from "../../../../utils/parseToken";
import { transferQueue } from "../SendMessageWithDelay";

export const checkRunStatusHandler = async (job) => {
  const { ticketId, companyId, promptKey, threadId, runId, msgData, contactId, promptId } = job.data;

  try {
    console.log("🟡 [CheckRunStatus] Verificando status do run...");

    const runStatusResponse = await axios.get(
      `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
      { headers: { authorization: `Bearer ${promptKey}`, "OpenAI-Beta": "assistants=v2" } }
    );

    const status = runStatusResponse.data.status;
    console.log(`📊 [CheckRunStatus] Status do run: ${status}`);

    if (status === "completed") {
      console.log("🔵 [CheckRunStatus] Run completo. Movendo para SendMessage...");

      return await SendMessageQueue.add("SendMessage", {
        ticketId,
        companyId,
        promptKey,
        threadId,
        msgData,
        contactId,
        promptId
      }, {
        removeOnComplete: true
      });
    }
    if (status === "requires_action") {
      console.log("🔴 [CheckRunStatus] Ação requerida detectada. Movendo para RequiresActionQueue...");

      return await RequiresActionQueue.add("RequiresAction", {
        threadId,
        runId,
        requiredAction: runStatusResponse.data.required_action,
        ticketId,
        companyId,
        promptKey,
        msgData,
        contactId,
        promptId
      });
    }

    if (status === "failed") {
      console.log("🔴 [CheckRunStatus] Falhou. Movendo transferindo fila...");

      console.log("-------------")
      console.error(`[DEBUG CheckRunStatus] - Erro no job ID: ${job.id}`);
      console.dir(runStatusResponse)
      console.log("-------------")

      const realTicket = await ShowTicketService(ticketId, companyId);
      const prompt = realTicket.queue.prompt
      const parsedKeys = parseToken(prompt.prompt);

      if (parsedKeys?.relations) {
        const keywordToQueueMap = {};
        parsedKeys.relations.forEach(relation => {
          keywordToQueueMap[relation.key.toLowerCase()] = relation.queue;
        });

        const matchedKeyword = Object.keys(keywordToQueueMap).find(keyword =>
          "failed"?.toLowerCase().includes(keyword)
        );

        if (matchedKeyword) {
          const queueId = keywordToQueueMap[matchedKeyword];
          return await transferQueue(+queueId, realTicket, realTicket.contact);
        }
      }


    }
    console.log("🔄 [CheckRunStatus] Run incompleto. Reenfileirando...");
    await job.moveToDelayed(Date.now() + 5000); // Reenfileira após 5s

  } catch (error) {
    console.error("❌ [CheckRunStatus] Erro:", error.message);
    throw error;
  }
};
