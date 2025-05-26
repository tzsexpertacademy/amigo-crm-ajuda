import Schedule from "../../models/Schedule";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import User from "../../models/User";
import Ticket from "../../models/Ticket";

const ScheduleService = async (id: string | number, companyId: number, isToReturnTicket: boolean = false): Promise<any> => {
  const schedule = await Schedule.findByPk(id, {
    include: [
      { model: Contact, as: "contact", attributes: ["id", "name"] },
      { model: User, as: "user", attributes: ["id", "name"] },
    ]
  });

  if (!schedule) {
    throw new AppError("ERR_NO_SCHEDULE_FOUND", 404);
  }

  if (schedule?.companyId !== companyId) {
    throw new AppError("Não é possível excluir registro de outra empresa");
  }

  if(!isToReturnTicket){
    return schedule;
  }

  // Busca o contato associado
  const contactId = schedule.contact?.id;

 

  let lastTicket = null;
  if (contactId) {
    // Busca o último Ticket associado ao contato
    lastTicket = await Ticket.findOne({
      where: { contactId },
      order: [["createdAt", "DESC"]],
    });
  }

  // Adiciona a informação do último ticket ao retorno do usuário
  return {
    ...schedule.toJSON(),
    lastTicket,
  } as any;
};

export default ScheduleService;
