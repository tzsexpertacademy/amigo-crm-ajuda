import axios from "axios";
import ShowTicketService from "../../../TicketServices/ShowTicketService";
import ShowContactService from "../../../ContactServices/ShowContactService";
import GetWhatsappWbot from "../../../../helpers/GetWhatsappWbot";
import { sendMessageWithDelay } from "../SendMessageWithDelay";

export const sendMessageHandler = async (job) => {
    const { ticketId, companyId, promptKey, threadId, msgData, contactId } = job.data;

    try {
        console.log("🔵 [SendMessage] Buscando resposta...");

        const response = await axios.get(
            `https://api.openai.com/v1/threads/${threadId}/messages`,
            { headers: { authorization: `Bearer ${promptKey}`, "OpenAI-Beta": "assistants=v2" } }
        ); 

        const sortedMessages = response.data.data.sort(
            (a: any, b: any) => a.created_at - b.created_at
        );
        const lastMessage = sortedMessages[sortedMessages.length - 1];
        // console.log("🔵 [SendMessage] Resposta: ");
        // console.dir(lastMessage)

        if (lastMessage.role === "assistant") {
            const assistantMessage = lastMessage.content[0]?.text?.value || null;

            if (assistantMessage) {
                console.log("📤 [SendMessage] Enviando resposta para o usuário...");
                const realTicket = await ShowTicketService(ticketId, companyId);
                const contact = await ShowContactService(contactId, companyId);
                const prompt = realTicket.queue.prompt;

                // console.log("🔵 [SendMessage] Prompt: ");
                // console.dir(prompt)

                await sendMessageWithDelay({ whatsapp: realTicket.whatsapp , msg: msgData, prompt, ticket: realTicket, contact: realTicket.contact }, assistantMessage);
                console.log("✅ [SendMessage] Resposta enviada com sucesso.");
            }
        }
    } catch (error) {
        console.error("❌ [SendMessage] Erro:", error.message);
        throw error;
    }
};
