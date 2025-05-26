import { Op } from "sequelize";
import Ticket from "./models/Ticket";
import Contact from "./models/Contact";
import User from "./models/User";
import Queue from "./models/Queue";
import Prompt from "./models/Prompt";
import Whatsapp from "./models/Whatsapp";
import Message from "./models/Message";
import { logger } from "./utils/logger";
import { verifyQueue } from "./services/WbotServices/wbotMessageListener";
import GetTicketWbot from "./helpers/GetTicketWbot";
import moment from "moment";

let reprocessLock = false;

export const reprocessOpenaiMessage = async (): Promise<void> => {
  if (reprocessLock) {
    console.log("⚠️ [REPROCESSO] Já está em execução. Abortando...");
    return;
  }

  reprocessLock = true;
  console.log("🔄 [REPROCESSO] Iniciando reprocessamento de mensagens pendentes...");

  try {
    // 🔎 Define o limite de 3 minutos atrás
    const threeMinutesAgo = moment().subtract(5, "minutes").format();

    // 🔍 Buscar tickets abertos com mensagens recentes não respondidas
    const tickets = await Ticket.findAll({
      where: {
        status: "open",
        isInReprocess: { [Op.ne]: 1 }
      },
      include: [
        {
          model: Contact,
          as: "contact",
          attributes: ["id", "name", "number"]
        },
        {
          model: User,
          as: "user",
          attributes: ["id", "name"]
        },
        {
          model: Queue,
          as: "queue",
          required: true,
          where: { promptId: { [Op.ne]: null } },
          include: [{ model: Prompt, as: "prompt", required: true }]
        },
        {
          model: Whatsapp,
          as: "whatsapp",
          attributes: ["name"]
        },
        {
          model: Message,
          as: "messages",
          where: {
            fromMe: false,  // 🔍 Mensagens enviadas pelo usuário
            updatedAt: { [Op.gte]: threeMinutesAgo }  // ⏳ Mensagens recentes (últimos 3 minutos)
          },
          required: true
        }
      ]
    });

    if (!tickets.length) {
      console.log("✅ [REPROCESSO] Nenhum ticket pendente para reprocessar.");
      reprocessLock = false;
      return;
    }

    for (const ticket of tickets) {
      try {
        // 🔍 Busca todas as mensagens ordenadas
        const messages = await Message.findAll({
          where: { ticketId: ticket.id },
          order: [["createdAt", "DESC"]]
        });

        // 🔄 Filtra mensagens não respondidas
        const messagesToReprocess = [];
        for (const message of messages) {
          if (message.fromMe) break; // Para ao encontrar a primeira resposta
          messagesToReprocess.push(message);
        }

        if (!messagesToReprocess.length) {
          console.log(`✅ [TICKET ${ticket.id}] Todas as mensagens já foram respondidas.`);
          continue;
        }

        // 🔒 Marca o ticket como em reprocessamento
        await Ticket.update({ isInReprocess: 1 }, { where: { id: ticket.id } });

        logger.info(`📨 [TICKET ${ticket.id}] Iniciando reprocessamento de ${messagesToReprocess.length} mensagens...`);

        // 🔁 Processa as mensagens pendentes
        const wbot = await GetTicketWbot(ticket);
        const contact = ticket.contact;

        for (const messageR of messagesToReprocess) {
          const data = {
            key: {
              remoteJid: `${contact.number}@s.whatsapp.net`,
              fromMe: false,
              id: messageR.id
            },
            messageTimestamp: messageR.createdAt.getTime() / 1000,
            broadcast: false,
            message: {
              conversation: messageR.body
            }
          };

          console.log(`🔄 [TICKET ${ticket.id}] Reprocessando mensagem: ${messageR.body}`);
          await verifyQueue(wbot, data, ticket, contact);
        }

        logger.info(`✅ [TICKET ${ticket.id}] Reprocessamento concluído.`);

        // 🔓 Libera o ticket
        await Ticket.update({ isInReprocess: 0 }, { where: { id: ticket.id } });

      } catch (error) {
        logger.error(`❌ [TICKET ${ticket.id}] Erro no reprocessamento: ${error.message}`);
        await Ticket.update({ isInReprocess: 0 }, { where: { id: ticket.id } });
      }
    }

  } catch (error) {
    console.error(`❌ [ERROR] Erro no reprocessamento geral: ${error.message}`);
  } finally {
    reprocessLock = false;
  }
};
