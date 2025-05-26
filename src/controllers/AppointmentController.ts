import { Request, Response } from "express";
import { Op, Sequelize } from "sequelize";
import Appointment from "../models/Appointment";
import User from "../models/User";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";
import Services from "../models/Service";
import Schedule from "../models/Schedule";
import Company from "../models/Company";
type IndexQuery = {
  searchParam?: string;
  contactId?: number | string;
  userId?: number | string;
  pageNumber?: string | number;
};

class AppointmentController {
  // Listar todos os agendamentos
  async index(req: Request, res: Response): Promise<Response> {
    try {
      const appointments = await Appointment.findAll({ 
        include: [User, Ticket],
      });
      return res.json(appointments);
    } catch (error) {
      return res.status(500).json({ error: "Erro ao listar agendamentos" });
    }
  }
  
  async showByTicket(req: Request, res: Response): Promise<Response> {
    const { ticketId } = req.params;
    const { companyId } = req.query ;
    if(!ticketId || !companyId) return res.status(400).json({msg: "TicketId or CompanyId is missing"})
    try {
      const appointments = await Appointment.findAll({
        where: {ticketId},
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "name", "profession"],
            where: {
              companyId: companyId,
            },
          },
          {
            model: Ticket,
            attributes: ["id",],
            as: "ticket",
          },
          {
            model: Services,
            as: "service",  // ✅ Correção: usando o alias correto
          },
        ],
      });
      return res.json(appointments);
    } catch (error) {
      console.log("[ERROR showByTicket]", error)
      return res.status(500).json({ error: "Erro ao listar agendamentos" });
    }
  }

  async indexV2(req: Request, res: Response): Promise<Response> {
    const { contactId, pageNumber, searchParam } = req.query as IndexQuery;
    const { companyId, id: userId, profile } = req.user;

    const limit = 20;
    const page = Number(pageNumber) > 0 ? Number(pageNumber) : 1;
    const offset = limit * (page - 1);

    const includeConditions: any[] = [
      {
        model: Ticket,
        as: "ticket",
        attributes: ["id", "uuid"],
        where: contactId ? { contactId } : undefined,
        include: [
          {
            model: Contact,
            as: "contact",
            attributes: ["id", "name"],
            where: searchParam
              ? {
                name: {
                  [Op.iLike]: `%${searchParam}%`  // Busca flexível no nome do contato
                }
              }
              : undefined
          }
        ]
      },
      {
        model: User,
        as: "user",
        attributes: ["id", "name"],
        where: {
          ...(userId && profile !=='admin' && { id: userId }),
          companyId: companyId
        }
      }
    ];

    const { count, rows: appointments } = await Appointment.findAndCountAll({
      limit,
      offset,
      order: [["createdAt", "DESC"]],
      include: includeConditions
    });

    const hasMore = count > offset + appointments.length;

    return res.json({ appointments, count, hasMore });
  }



  // Criar um novo agendamento
  async store(req: Request, res: Response): Promise<Response> {
    const { scheduledDate, description, status, userId, ticketId, serviceId } = req.body;

    const userFound = await User.findByPk(userId);
    const ticketFound = await Ticket.findOne({
      where: {
        id: ticketId
      },
      include: [
        {
          model: Contact,
          as: "contact",
          attributes: ["id", "name", "number", "email", "profilePicUrl"],
          include: ["extraInfo"]
        },
        { model: Company, as: "company", attributes: ["id", "name"] }
      ]
    });

    const scheduleDateToSave = new Date(scheduledDate);
    let appointment: any = null;

    try {
      appointment = await Appointment.create({
        scheduledDate: scheduleDateToSave,
        description,
        status,
        userId,
        ticketId,
        serviceId
      });
      await appointment.save()

      const newSchedule = await Schedule.create({
        body: userFound?.body ?? "",
        body_one_hour: userFound?.body_one_hour ?? "",
        body_ten_min: userFound?.body_ten_min ?? "",
        sendAt: scheduleDateToSave,
        ticketId,
        contactId: ticketFound?.contact?.id,
        companyId: ticketFound?.company?.id

      })

      newSchedule.save()
    } catch (error) {
      console.log("ERROR [STORE APPOINTMENT]", error)
      return res.status(500).json({ error: "Erro ao criar agendamento" });
    }
    
    return res.status(201).json(appointment);
  }

  // Atualizar um agendamento existente
  async update(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { scheduledDate, description, status, serviceId } = req.body;

    try {
      const appointment = await Appointment.findByPk(id);

      if (!appointment) {
        return res.status(404).json({ error: "Agendamento não encontrado" });
      }

      await appointment.update({
        scheduledDate,
        description,
        status,
        serviceId
      });

      return res.json(appointment);
    } catch (error) {
      return res.status(500).json({ error: "Erro ao atualizar agendamento" });
    }
  }
  async cancell(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { ticketId } = req.body;

    try {
      const appointment = await Appointment.findOne({
        where:{
          id, 
          ticketId
        }
      });

      if (!appointment) {
        return res.status(404).json({ error: "Agendamento não encontrado" });
      }

      await appointment.update({
        status: "cancelled"
      });

      return res.json(appointment);
    } catch (error) {
      return res.status(500).json({ error: "Erro ao atualizar agendamento" });
    }
  }

  // Deletar um agendamento
  async delete(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;

    try {
      const appointment = await Appointment.findByPk(id);

      if (!appointment) {
        return res.status(404).json({ error: "Agendamento não encontrado" });
      }

      await appointment.destroy();
      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ error: "Erro ao deletar agendamento" });
    }
  }

  // Obter um agendamento específico
  async show(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { companyId } = req.user;


    try {
      const appointment = await Appointment.findByPk(id, {
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "name"],
            where: {
              companyId: companyId,
            },
          },
          {
            model: Ticket,
            as: "ticket",
          },
          {
            model: Services,
            as: "service",  // ✅ Correção: usando o alias correto
          },
        ],
      });

      if (!appointment) {
        return res.status(404).json({ error: "Agendamento não encontrado" });
      }

      return res.json(appointment);
    } catch (error) {
      console.log(error)
      return res.status(500).json({ error: "Erro ao buscar agendamento" });
    }
  }
}

export default new AppointmentController();
