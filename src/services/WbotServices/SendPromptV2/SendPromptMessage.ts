import { getIO } from "../../../libs/socket";
import { PromptMessageQueue } from "./PromptMessageQueue";

export async function sendPromptMessageV2(
  body: any,
  ticket: any,
  msg: any,
  contact: any,
  prompt: any
): Promise<void> {

  const promptKey = ticket.queue.prompt.apiKey;

  // 🔒 Enviando apenas IDs para evitar circularidade
  await PromptMessageQueue.add("SendPrompt", {
    body,
    ticketId: ticket.id,
    companyId: ticket.companyId,
    promptKey,
    msgData: {
      key: {
        remoteJid: msg?.key?.remoteJid,
        message: msg?.message
      }
    },
    contactId: contact.id,
    promptId: prompt.id,
    prompt: prompt.prompt,
    threadId: ticket.threadId,
    queueId: ticket.queue?.id
  });

 


  console.log(`📨 Mensagem adicionada à fila para o ticket ${ticket.id}`);
}
