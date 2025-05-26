import { Op } from "sequelize";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { getIO } from "../../libs/socket";
import formatBody from "../../helpers/Mustache";
import SendWhatsAppMessage from "./SendWhatsAppMessage";
import moment from "moment";
import ShowTicketService from "../TicketServices/ShowTicketService";
import { verifyMessage } from "./wbotMessageListener";
import TicketTraking from "../../models/TicketTraking";
import Company from "../../models/Company";
import Message from "../../models/Message";
import Queue from "../../models/Queue";

export const ClosedAllOpenTickets = async (
  companyId: number
): Promise<void> => {
  return;
  const closeTicket = async (ticket: any, currentStatus: any, body: any) => {
    if (currentStatus === "nps") {
      await ticket.update({
        status: "closed",
        //userId: ticket.userId || null,
        lastMessage: body,
        unreadMessages: 0,
        amountUseBotQueues: 0
      });
    } else if (currentStatus === "open") {
      await ticket.update({
        status: "closed",
        //  userId: ticket.userId || null,
        lastMessage: body,
        unreadMessages: 0,
        amountUseBotQueues: 0
      });
    } else {
      await ticket.update({
        status: "closed",
        //userId: ticket.userId || null,
        unreadMessages: 0
      });
    }
  };

  const io = getIO();
  try {
    const { rows: tickets } = await Ticket.findAndCountAll({
      where: { status: { [Op.in]: ["open"] }, companyId },
      order: [["updatedAt", "DESC"]]
    });

    tickets.forEach(async ticket => {
      const showTicket = await ShowTicketService(ticket.id, companyId);
      const whatsapp = await Whatsapp.findByPk(showTicket?.whatsappId);
      const ticketTraking = await TicketTraking.findOne({
        where: {
          ticketId: ticket.id,
          finishedAt: null
        }
      });

      if (!whatsapp) return;

      let {
        expiresInactiveMessage, //mensage de encerramento por inatividade
        expiresTicket //tempo em horas para fechar ticket automaticamente
      } = whatsapp;

      // @ts-ignore: Unreachable code error
      if (
        expiresTicket &&
        (expiresTicket as any) !== "" &&
        // @ts-ignore: Unreachable code error
        expiresTicket !== "0" &&
        Number(expiresTicket) > 0
      ) {
        //mensagem de encerramento por inatividade
        const bodyExpiresMessageInactive = formatBody(
          `\u200e ${expiresInactiveMessage}`,
          showTicket.contact
        );

        const dataLimite = new Date();
        dataLimite.setMinutes(dataLimite.getMinutes() - Number(expiresTicket));

        if (showTicket.status === "open" && !showTicket.isGroup) {
          const dataUltimaInteracaoChamado = new Date(showTicket.updatedAt);

          if (dataUltimaInteracaoChamado < dataLimite && showTicket.fromMe) {
            closeTicket(
              showTicket,
              showTicket.status,
              bodyExpiresMessageInactive
            );

            if (
              expiresInactiveMessage !== "" &&
              expiresInactiveMessage !== undefined
            ) {
              const sentMessage = await SendWhatsAppMessage({
                body: bodyExpiresMessageInactive,
                ticket: showTicket
              });

              await verifyMessage(sentMessage, showTicket, showTicket.contact);
            }

            await ticketTraking.update({
              finishedAt: moment().toDate(),
              closedAt: moment().toDate(),
              whatsappId: ticket.whatsappId,
              userId: ticket.userId
            });

            io.to("open").emit(`company-${companyId}-ticket`, {
              action: "delete",
              ticketId: showTicket.id
            });
          }
        }
      }
    });
  } catch (e: any) {
    console.log("e", e);
  }
};
export const ClosedAllOpenTicketsWithoutPassCompany =
  async (): Promise<void> => {
    const io = getIO();
    const closeTicket = async (ticket: any, currentStatus: any, body: any) => {
      console.log(
        "TICKET ID: ",
        ticket.id,
        "IN CLOSE TICKET FUNCITON",
        currentStatus,
        body
      );
      if (currentStatus === "nps") {
        await ticket.update({
          status: "closed",
          //userId: ticket.userId || null,
          lastMessage: body,
          unreadMessages: 0,
          amountUseBotQueues: 0
        });
      } else if (currentStatus === "open") {
        await ticket.update({
          status: "closed",
          //  userId: ticket.userId || null,
          lastMessage: body,
          unreadMessages: 0,
          amountUseBotQueues: 0
        });
      } else {
        await ticket.update({
          status: "closed",
          //userId: ticket.userId || null,
          unreadMessages: 0
        });
      }
    };

    const companies = await Company.findAll();

    const chunkSize = 300;
    for (let i = 0; i < companies.length; i += chunkSize) {
      const companiesChunk = companies.slice(i, i + chunkSize);
      // console.log("[COMPANYS] - ", companiesChunk.length);
      await Promise.all(
        companiesChunk.map(async company => {
          const companyId = company.id;

          try {
            const { rows: tickets } = await Ticket.findAndCountAll({
              where: {
                status: { [Op.in]: ["open"] },
                queueId: {
                  [Op.ne]: null
                },
                companyId
              },
              include: [
                {
                  model: Queue,
                  where: {
                    disableInactiveMessages: false
                  }
                }
              ],
              order: [["updatedAt", "DESC"]]
            });

            // console.log("[TICKETS TO CLOSE]", tickets);

            tickets.forEach(async ticket => {
              const showTicket = await ShowTicketService(ticket.id, companyId);
              const whatsapp = await Whatsapp.findByPk(showTicket?.whatsappId);
              const queue = await Queue.findByPk(ticket.queueId);
              const ticketTraking = await TicketTraking.findOne({
                where: {
                  ticketId: ticket.id,
                  finishedAt: null
                }
              });

              if (!whatsapp) return;

              if (queue?.disableInactiveMessages) {
                return;
              }

              let {
                expiresInactiveMessage, //mensage de encerramento por inatividade
                expiresTicket //tempo em horas para fechar ticket automaticamente
              } = whatsapp;

              // console.log(
              //   "[CLOSE - expiresInactiveMessage, expiresTicket]",
              //   expiresInactiveMessage,
              //   expiresTicket
              // );
              // @ts-ignore: Unreachable code error
              if (
                expiresTicket &&
                expiresInactiveMessage !== "" &&
                // @ts-ignore: Unreachable code error
                expiresTicket !== "0" &&
                Number(expiresTicket) > 0
              ) {
                // console.log("[CONDICTION 1 ACCEPTED]");

                //mensagem de encerramento por inatividade
                const bodyExpiresMessageInactive = formatBody(
                  `${expiresInactiveMessage}`,
                  showTicket.contact
                );

                const dataLimite = new Date();
                dataLimite.setMinutes(
                  dataLimite.getMinutes() - Number(expiresTicket)
                );

                // console.log("[CONDICTION 1 VALUES]", dataLimite);

                const lastMessage = await Message.findOne({
                  where: {
                    ticketId: ticket.id
                  },
                  order: [["createdAt", "DESC"]]
                });

                if (!lastMessage) return;

                if (showTicket.status === "open" && !showTicket.isGroup) {
                  // console.log("[CONDICTION 2 ACCEPTED]");

                  const dataUltimaInteracaoChamado = new Date(
                    lastMessage.updatedAt
                  );

                  if (
                    dataUltimaInteracaoChamado < dataLimite &&
                    showTicket.fromMe
                  ) {
                    // console.log("[CONDICTION 3 ACCEPTED]");

                    closeTicket(
                      showTicket,
                      showTicket.status,
                      bodyExpiresMessageInactive
                    );

                    if (
                      expiresInactiveMessage !== "" &&
                      expiresInactiveMessage !== undefined
                    ) {
                      const sentMessage = await SendWhatsAppMessage({
                        body: bodyExpiresMessageInactive,
                        ticket: showTicket
                      });

                      await verifyMessage(
                        sentMessage,
                        showTicket,
                        showTicket.contact
                      );
                    }

                    await ticketTraking.update({
                      finishedAt: moment().toDate(),
                      closedAt: moment().toDate(),
                      whatsappId: ticket.whatsappId,
                      userId: ticket.userId
                    });

                    io.to("open").emit(`company-${companyId}-ticket`, {
                      action: "delete",
                      ticketId: showTicket.id
                    });
                  } else {
                    console.log(
                      // "[CONDICTION 3 REJECTED]",
                      dataUltimaInteracaoChamado,
                      dataLimite
                    );
                  }
                } else {
                  // console.log("[CONDICTION 2 REJECTED]");
                }
              }
            });
          } catch (e: any) {
            console.log("e", e);
          }
        })
      );
    }
  };
