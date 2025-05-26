const axios = require("axios");
const ShowTicketService =
  require("../../services/TicketServices/ShowTicketService").default;
const ShowContactService =
  require("../../services/ContactServices/ShowContactService").default;
// const GetWhatsappWbot = require("../../helpers/GetWhatsappWbot");
const {
  sendMessageWithDelay
} = require("../../services/WbotServices/SendPromptV2/SendMessageWithDelay");
const socket = require("../../workers/socket"); // Importa o cliente Socket.IO

const sendMessageHandler = async job => {
  const { ticketId, companyId, promptKey, threadId, msgData, contactId } =
    job.data;

  try {
    console.log("🔵 [SendMessage] Buscando resposta...");

    const response = await axios.get(
      `https://api.openai.com/v1/threads/${threadId}/messages`,
      {
        headers: {
          authorization: `Bearer ${promptKey}`,
          "OpenAI-Beta": "assistants=v2"
        }
      }
    );

    const sortedMessages = response.data.data.sort(
      (a, b) => a.created_at - b.created_at
    );
    const lastMessage = sortedMessages[sortedMessages.length - 1];

    if (lastMessage.role === "assistant") {
      const assistantMessage = lastMessage.content[0]?.text?.value || null;

      if (assistantMessage) {
        console.log("📤 [SendMessage] Enviando resposta para o usuário...");

        const realTicket = await ShowTicketService(ticketId, companyId);
        const contact = await ShowContactService(contactId, companyId);
        // const wbot = await GetWhatsappWbot(realTicket.whatsapp);
        // const prompt = realTicket.queue.prompt;

        // Envia a mensagem
        // await sendMessageWithDelay(
        // { wbot, msg: msgData, prompt, ticket: realTicket, contact: realTicket.contact },
        // assistantMessage
        // );

        // Emite evento para o WebSocket
        socket.emit("message:sent", {
          ticketId: ticketId,
          promptId: realTicket.queue.prompt.id,
          contactId: realTicket.contact.id,
          contactName: contact.name,
          companyId,
          msgData,
          assistantMessage
        });

        console.log(
          "✅ [SendMessage] Resposta enviada e evento emitido com sucesso."
        );
      }
    }
  } catch (error) {
    console.error("❌ [SendMessage] Erro:", error.message);

    // Emite evento de erro no WebSocket
    socket.emit("message:failed", {
      ticketId,
      error: error.message
    });

    throw error;
  }
};

module.exports = { sendMessageHandler };
