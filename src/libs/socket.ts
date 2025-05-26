import { Server as SocketIO } from "socket.io";
import { Server } from "http";
import AppError from "../errors/AppError";
import { logger } from "../utils/logger";
import User from "../models/User";
import Queue from "../models/Queue";
import Ticket from "../models/Ticket";
import { verify } from "jsonwebtoken";
import authConfig from "../config/auth";
import { CounterManager } from "./counter";
import { sendMessageWithDelay } from "../services/WbotServices/SendPromptV2/SendMessageWithDelay";
import ShowTicketService from "../services/TicketServices/ShowTicketService";

let io: SocketIO;

export const initIO = (httpServer: Server): SocketIO => {
  io = new SocketIO(httpServer, {
    cors: {
      origin: "*"
    }
  });

  io.on("connection", async socket => {
    logger.info("Client Connected");
    const { token } = socket.handshake.query;
    let tokenData = null;
    try {
      if (token !== "PvRchRvbC3bbcJ!H9^f&iL") {
        tokenData = verify(token as string, authConfig.secret);
      } else {
        tokenData = {
          id: "queues",
          companyId: "own"
        };
      }
      logger.debug(tokenData, "io-onConnection: tokenData");
    } catch (error) {
      logger.warn(`[libs/socket.ts] Error decoding token: ${error?.message}`);
      socket.disconnect();
      return io;
    }
    const counters = new CounterManager();

    let user: User = null;
    let userId = tokenData.id;

    if (userId !== "queues") {
      if (userId && userId !== "undefined" && userId !== "null") {
        user = await User.findByPk(userId, { include: [Queue] });
        if (user) {
          user.online = true;
          await user?.save();
        } else {
          logger.info(`onConnect: User ${userId} not found`);
          socket.disconnect();
          return io;
        }
      } else {
        logger.info("onConnect: Missing userId");
        socket.disconnect();
        return io;
      }
    } else {
      user = {
        companyId: "own",
        profile: "admin",
        queues: []
      } as any;
    }

    socket.join(`company-${user?.companyId}-mainchannel`);
    socket.join(`user-${user?.id}`);

    socket.on("joinChatBox", async (ticketId: string) => {
      if (!ticketId || ticketId === "undefined") {
        return;
      }
      Ticket.findByPk(ticketId).then(
        ticket => {
          if (
            ticket &&
            ticket.companyId === user?.companyId &&
            (ticket.userId === user?.id || user?.profile === "admin")
          ) {
            let c: number;
            if ((c = counters.incrementCounter(`ticket-${ticketId}`)) === 1) {
              socket.join(ticketId);
            }
            logger.debug(
              `joinChatbox[${c}]: Channel: ${ticketId} by user ${user?.id}`
            );
          } else {
            logger.info(
              `Invalid attempt to join channel of ticket ${ticketId} by user ${user?.id}`
            );
          }
        },
        error => {
          logger.error(error, `Error fetching ticket ${ticketId}`);
        }
      );
    });

    socket.on("leaveChatBox", async (ticketId: string) => {
      if (!ticketId || ticketId === "undefined") {
        return;
      }

      let c: number;
      // o último que sair apaga a luz

      if ((c = counters.decrementCounter(`ticket-${ticketId}`)) === 0) {
        socket.leave(ticketId);
      }
      logger.debug(
        `leaveChatbox[${c}]: Channel: ${ticketId} by user ${user?.id}`
      );
    });

    socket.on("joinNotification", async () => {
      let c: number;
      if ((c = counters.incrementCounter("notification")) === 1) {
        if (user?.profile === "admin") {
          socket.join(`company-${user?.companyId}-notification`);
        } else {
          user?.queues.forEach(queue => {
            logger.debug(
              `User ${user?.id} of company ${user?.companyId} joined queue ${queue.id} channel.`
            );
            socket.join(`queue-${queue.id}-notification`);
          });
          if (user?.allTicket === "enabled") {
            socket.join("queue-null-notification");
          }
        }
      }
      logger.debug(`joinNotification[${c}]: User: ${user?.id}`);
    });

    socket.on("leaveNotification", async () => {
      let c: number;
      if ((c = counters.decrementCounter("notification")) === 0) {
        if (user?.profile === "admin") {
          socket.leave(`company-${user?.companyId}-notification`);
        } else {
          user?.queues.forEach(queue => {
            logger.debug(
              `User ${user?.id} of company ${user?.companyId} leaved queue ${queue.id} channel.`
            );
            socket.leave(`queue-${queue.id}-notification`);
          });
          if (user?.allTicket === "enabled") {
            socket.leave("queue-null-notification");
          }
        }
      }
      logger.debug(`leaveNotification[${c}]: User: ${user?.id}`);
    });

    socket.on("joinTickets", (status: string) => {
      if (counters.incrementCounter(`status-${status}`) === 1) {
        if (user?.profile === "admin") {
          logger.debug(
            `Admin ${user?.id} of company ${user?.companyId} joined ${status} tickets channel.`
          );
          socket.join(`company-${user?.companyId}-${status}`);
        } else if (status === "pending") {
          user?.queues.forEach(queue => {
            logger.debug(
              `User ${user?.id} of company ${user?.companyId} joined queue ${queue.id} pending tickets channel.`
            );
            socket.join(`queue-${queue.id}-pending`);
          });
          if (user?.allTicket === "enabled") {
            socket.join("queue-null-pending");
          }
        } else {
          logger.debug(`User ${user?.id} cannot subscribe to ${status}`);
        }
      }
    });

    socket.on("leaveTickets", (status: string) => {
      if (counters.decrementCounter(`status-${status}`) === 0) {
        if (user?.profile === "admin") {
          logger.debug(
            `Admin ${user?.id} of company ${user?.companyId} leaved ${status} tickets channel.`
          );
          socket.leave(`company-${user?.companyId}-${status}`);
        } else if (status === "pending") {
          user?.queues.forEach(queue => {
            logger.debug(
              `User ${user?.id} of company ${user?.companyId} leaved queue ${queue.id} pending tickets channel.`
            );
            socket.leave(`queue-${queue.id}-pending`);
          });
          if (user?.allTicket === "enabled") {
            socket.leave("queue-null-pending");
          }
        }
      }
    });

    socket.on("test:event", data => {
      console.log("📩 Test Event Recebido:", data);
    });

    socket.on("message:sent", async data => {
      logger.info(`📤 Mensagem enviada com sucesso: ${JSON.stringify(data)}`);
      const { ticketId, assistantMessage, companyId, msgData } = data
      const realTicket = await ShowTicketService(ticketId, companyId);

      try {
        if (realTicket?.status == 'pending' || !realTicket?.status) {


          const ticketToUpdate = await Ticket.findOne({ where: { id: realTicket.id } });
          await ticketToUpdate.update({
            status: "open",
          });
          await ticketToUpdate.reload();

          const io = getIO();
          io.to(`company-${ticketToUpdate.companyId}-open`)
          .to(`queue-${ticketToUpdate.queueId}-open`)
          .emit(`company-${ticketToUpdate.companyId}-ticket`, {
            action: "delete",
            ticket: ticketToUpdate,
            ticketId: ticketToUpdate.id
          });
          io.to(`company-${ticketToUpdate.companyId}-${ticketToUpdate.status}`)
            .to(`queue-${ticketToUpdate.queueId}-${ticketToUpdate.status}`)
            .to(ticketToUpdate.id.toString())
            .emit(`company-${ticketToUpdate.companyId}-ticket`, {
              action: "update",
              ticket: ticketToUpdate,
              ticketId: ticketToUpdate.id
            });
        }

      } catch (error) {
        console.error("--------------------------")
        console.error("[ERROR - message:sent]");
        console.error(error);
        console.error("--------------------------")
      }
      const prompt = realTicket.queue.prompt;

      await sendMessageWithDelay(
        {
          whatsapp: realTicket.whatsapp,
          msg: msgData,
          ticketId,
          prompt,
          ticket: realTicket,
          contact: realTicket.contact
        },
        assistantMessage
      );
      // Aqui você pode salvar no banco de dados, emitir para outros sockets, etc.
      // io.to(`company-${data.companyId}-mainchannel`).emit("message:sent", data);
    });

    socket.on("message:media", async data => {
      logger.info(`📤 Mensagem de midia enviada com sucesso: ${JSON.stringify(data)}`);
      const { ticketId, companyId, msgData, media } = data
      const realTicket = await ShowTicketService(ticketId, companyId);
      const prompt = realTicket.queue.prompt;

      await sendMessageWithDelay(
        {
          whatsapp: realTicket.whatsapp,
          msg: msgData,
          prompt,
          ticket: realTicket,
          contact: realTicket.contact,
          media,
          isMedia: true,
        },
        ''
      );
      // Aqui você pode salvar no banco de dados, emitir para outros sockets, etc.
      // io.to(`company-${data.companyId}-mainchannel`).emit("message:sent", data);
    });

    // Escutar evento de erro ao enviar mensagem
    socket.on("message:failed", data => {
      logger.error(`❌ Erro ao enviar mensagem: ${JSON.stringify(data)}`);
      // io.to(`company-${data.companyId}-mainchannel`).emit(
      //   "message:failed",
      //   data
      // );
    });

    socket.emit("ready");
  });

  return io;
};

export const getIO = (): SocketIO => {
  if (!io) {
    throw new AppError("Socket IO not initialized");
  }
  return io;
};
