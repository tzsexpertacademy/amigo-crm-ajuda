import Schedule from "../../models/Schedule";
import Contact from "../../models/Contact";
import User from "../../models/User";
import UserServices from "../../models/UserServices";
import ContactCustomField from "../../models/ContactCustomField";
import CreateService from "../ScheduleServices/CreateService";
import CancelService from "../ScheduleServices/CancelService";
import ShowTicketService from "../TicketServices/ShowTicketService";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";
import * as Sentry from "@sentry/node";
const {
  parseISO,
  addHours,
  setHours,
  setMinutes,
  setSeconds,
  format,
  addDays
} = require("date-fns");
import { ptBR } from "date-fns/locale";
import Appointment from "../../models/Appointment";
import { isBefore } from "date-fns";
import moment from "moment";
import { Op } from "sequelize";
import Services from "../../models/Service";
import Service from "../../models/Service";


const find_customer = async (
  { field }: { field: string },
  accountInfo: any
): Promise<string> => {
  const { ticketId, companyId } = accountInfo;

  try {
    let contact;

    try {
      contact = await ShowTicketService(ticketId, companyId);
      console.log("[FIND CUSTOMER] - Contact fetched:", contact?.dataValues);
    } catch (error) {
      console.error("[FIND CUSTOMER] - Error in ShowTicketService:", error);
      return "null";
    }

    if (!contact || !contact.contact) {
      console.log("[FIND CUSTOMER] - Contact not found");
      return "null";
    }

    const contactData = contact.contact;

    if (["name", "email", "number"].includes(field)) {
      const value = contactData[field];
      if (value) {
        console.log(`[FIND CUSTOMER] - Found field '${field}':`, value);
        return value;
      } else {
        console.log(`[FIND CUSTOMER] - Field '${field}' is empty or null`);
        return "null";
      }
    }

    const extraInfo = contactData.extraInfo || [];
    const fieldInfo = extraInfo.find((info: any) => info.name === field);

    if (fieldInfo) {
      console.log(`[FIND CUSTOMER] - Found field '${field}':`, fieldInfo.value);
      return fieldInfo.value || "null";
    }

    console.log(`[FIND CUSTOMER] - Field '${field}' not found`);
    return "false";
  } catch (error) {
    console.error("[FIND CUSTOMER] - General error:", error);
    return "null";
  }
};

const register_customer = async (
  { field, value }: { field: string; value: string },
  accountInfo: any
): Promise<string> => {
  const { contactId, companyId } = accountInfo;

  if (!contactId) {
    console.error("[REGISTER CUSTOMER] - Missing contactId");
    return "null";
  }

  try {
    let foundContact;

    try {
      foundContact = await Contact.findOne({
        where: { id: contactId },
        attributes: [
          "id",
          "name",
          "number",
          "email",
          "companyId",
          "profilePicUrl"
        ],
        include: ["extraInfo"]
      });
    } catch (error) {
      console.error("[REGISTER CUSTOMER] - Error finding contact:", error);
      return "null";
    }

    if (!foundContact) {
      console.log("[REGISTER CUSTOMER] - Contact not found");
      return "null";
    }

    if (foundContact.companyId !== companyId) {
      console.log("[REGISTER CUSTOMER] - Company mismatch");
      return "null";
    }

    if (
      !field ||
      typeof field !== "string" ||
      !value ||
      typeof value !== "string"
    ) {
      console.error("[REGISTER CUSTOMER] - Invalid field or value");
      return "null";
    }

    if (field === "number") {
      console.log("[REGISTER CUSTOMER] - Ignoring updates to 'number' field");
      return "true";
    }

    const contactData: any = {
      name: foundContact.name,
      number: foundContact.number,
      email: foundContact.email,
      profilePicUrl: foundContact.profilePicUrl
    };

    const extraInfoArray: any[] = Array.isArray(foundContact.extraInfo)
      ? foundContact.extraInfo
      : [];

    if (["name", "email"].includes(field)) {
      contactData[field] = value;
    } else {
      const existingField = extraInfoArray.find(
        (info: any) => info.name === field
      );
      if (existingField) {
        existingField.value = value;
      } else {
        extraInfoArray.push({ name: field, value });
      }
      contactData.extraInfo = extraInfoArray;
    }

    if (field === "name" && (!value || value.trim() === "")) {
      console.error("[REGISTER CUSTOMER] - Invalid name: cannot be empty");
      return "null";
    }

    if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      console.error("[REGISTER CUSTOMER] - Invalid email format");
      return "null";
    }

    console.log("[REGISTER CUSTOMER] - Final contactData:", contactData);

    try {
      let customFields: any = await ContactCustomField.findOne({
        where: { contactId: contactId }
      });

      console.log(
        "[REGISTER CUSTOMER] BEFORE UPDATE: ",
        contactId,
        customFields?.dataValues
      );
      extraInfoArray.forEach(info => {
        console.log("[REGISTER CUSTOMER] - Preparing upsert data:", {
          name: info.name,
          value: info.value,
          contactId
        });
      });

      await Promise.all(
        extraInfoArray.map(async (info: any) => {
          if (!info.name || !info.value || !contactId) {
            console.error(
              "[REGISTER CUSTOMER] - Invalid custom field data:",
              info
            );
            return;
          }
          await ContactCustomField.upsert({
            name: info.name,
            value: info.value,
            contactId
          });
        })
      );

      customFields = await ContactCustomField.findOne({
        where: { contactId: contactId }
      });

      console.log("[REGISTER CUSTOMER] UPDATED: ", contactId, customFields);
    } catch (error) {
      console.error(
        "[REGISTER CUSTOMER] - Error updating contact:",
        error?.parent?.detail || error?.message
      );
      return "null";
    }

    console.log("[REGISTER CUSTOMER] - Contact updated successfully");
    return "true";
  } catch (error) {
    console.error("[REGISTER CUSTOMER] - General error:", error);
    return "null";
  }
};

async function handleVerifySchedules(date: Date, companyId: number) {
  try {
    const { count, rows: schedules } = await Schedule.findAndCountAll({
      where: {
        sendAt: date,
        companyId: companyId
      },
      include: [
        {
          model: Contact,
          as: "contact"
        }
      ]
    });

    logger.info(
      `Found ${count} schedule(s) for company ${companyId} on ${date}`
    );

    return { count, schedules };
  } catch (e: any) {
    Sentry.captureException(e);
    logger.error("handleVerifySchedules -> error", e.message);
    throw e;
  }
}

const generateDateTemplate = (insertTemplate: boolean = true) => {
  const today = new Date();
  let template = `Hoje: ${format(
    today,
    "EEEE, d 'de' MMMM 'de' yyyy 'às' HH:mm",
    { locale: ptBR }
  )}\n`;
  if (!insertTemplate) return template;

  for (let i = 1; i <= 6; i++) {
    const nextDay = addDays(today, i);
    template += `(${i} dia${i > 1 ? "s" : ""} depois de hoje) ${format(
      nextDay,
      "EEEE: d 'de' MMMM 'de' yyyy",
      { locale: ptBR }
    )}\n`;
  }

  return template;
};

const get_current_date = (activeTemplate: boolean = true) => {
  // const now = new Date();
  return generateDateTemplate(activeTemplate);
}; //voltar

const check_calendar = async (payload: any, accountInfo: any) => {
  try {
    const { date, profissional_name, serviceId, professional_name } = payload;
    const { companyId } = accountInfo;

    const scheduleDate = addHours(parseISO(date), 3);

    // ✅ Verifica se a data é no passado
    if (isBefore(scheduleDate, new Date())) {
      const invalidDate = format(
        scheduleDate,
        "d 'de' MMMM 'de' yyyy 'às' HH:mm",
        { locale: ptBR }
      );
      const currentDate = format(
        new Date(),
        "d 'de' MMMM 'de' yyyy 'às' HH:mm",
        { locale: ptBR }
      );
      return `❌ Não é possível agendar para o passado. Data informada: ${invalidDate}. Data atual: ${currentDate}`;
    }

    let user: any = null;

    // ✅ Verifica se o profissional existe
    if (profissional_name || professional_name) {
      user = await User.findOne({
        where: {
          profile: "professional",
          companyId,
          name: profissional_name ?? professional_name
        },
        attributes: [
          "id",
          "schedules",
          "appointmentSpacing",
          "appointmentSpacingUnit"
        ],
        order: [["createdAt", "ASC"]]
      });

      if (!user) {
        return "❌ Profissional não encontrado.";
      }
    } else {
      user = await User.findOne({
        where: { profile: "professional", companyId },
        attributes: [
          "id",
          "schedules",
          "appointmentSpacing",
          "appointmentSpacingUnit"
        ],
        order: [["createdAt", "ASC"]]
      });

      if (!user) {
        return "❌ Nenhum profissional disponível.";
      }
    }

    // ✅ Verifica se o profissional atende no dia/hora
    const weekday = format(scheduleDate, "EEEE", {
      locale: ptBR
    }).toLowerCase();
    const hour = format(scheduleDate, "HH:mm");

    const scheduleDay = user.schedules.find(
      (s: any) => s.weekday.toLowerCase() === weekday
    );

    // ✅ Verifica se o profissional atende no dia e horário informado
    if (!scheduleDay || scheduleDay.startTime === scheduleDay.endTime) {
      return "❌ Profissional não atende neste dia.";
    }

    if (hour < scheduleDay.startTime || hour > scheduleDay.endTime) {
      return `❌ Profissional atende apenas entre ${scheduleDay.startTime} e ${scheduleDay.endTime}.`;
    }

    // ✅ Calcula o próximo horário disponível
    let nextAvailableTime;
    if (user.appointmentSpacingUnit === "hours") {
      nextAvailableTime = moment(scheduleDate)
        .add(user.appointmentSpacing, "hours")
        .format("YYYY-MM-DD HH:mm:ss");
    } else if (user.appointmentSpacingUnit === "min") {
      nextAvailableTime = moment(scheduleDate)
        .add(user.appointmentSpacing, "minutes")
        .format("YYYY-MM-DD HH:mm:ss");
    } else {
      return "❌ Unidade de espaçamento inválida. Use 'min' ou 'hours'.";
    }

    // ✅ Verifica conflitos de agendamento
    const conflictingAppointment = await Appointment.findOne({
      where: {
        userId: user.id,
        status: { [Op.ne]: "cancelled" },
        scheduledDate: {
          [Op.gt]: moment(scheduleDate)
            .subtract(user.appointmentSpacing, user.appointmentSpacingUnit)
            .format("YYYY-MM-DD HH:mm:ss"),
          [Op.lt]: nextAvailableTime
        }
      }
    });

    if (conflictingAppointment) {
      const conflictTime = format(
        conflictingAppointment.scheduledDate,
        "dd/MM/yyyy 'às' HH:mm",
        { locale: ptBR }
      );
      return `❌ Horário já ocupado até ${conflictTime}.`;
    }

    // ✅ Se todas as verificações passarem, retorna true
    return `✅ O horário esta disponível.
    Data Atual: ${get_current_date()}
    `;
  } catch (error: any) {
    logger.error("check_calendar -> error", error.message);
    return `❌ Erro ao verificar disponibilidade: ${error.message}`;
  }
};

const schedule = async (payload: any, accountInfo: any) => {
  try {
    const {
      date,
      date_first_aux,
      date_second_aux,
      message,
      message_first_aux,
      message_second_aux,
      professional_name,
      service_name
    } = payload;
    const { contactId, companyId, userId, ticketId } = accountInfo;

    console.log("[DEBUG schedule]");
    console.table({
      date,
      date_first_aux,
      date_second_aux,
      message,
      message_first_aux,
      message_second_aux,
      professional_name,
      service_name
    });

    const sendAt = addHours(parseISO(date), 3);
    const sendAt_first_aux = addHours(parseISO(date_first_aux), 3);
    const sendAt_second_aux = addHours(parseISO(date_second_aux), 3);

    if (isBefore(sendAt, new Date())) {
      const invalidDate = format(sendAt, "d 'de' MMMM 'de' yyyy 'às' HH:mm", {
        locale: ptBR
      });
      const currentDate = format(
        new Date(),
        "d 'de' MMMM 'de' yyyy 'às' HH:mm",
        { locale: ptBR }
      );
      return `Não é possível agendar para o passado. Data informada: ${invalidDate}. Data atual: ${currentDate}`;
    }

    let user: any = null;

    if (professional_name) {
      user = await User.findOne({
        where: {
          profile: "professional",
          companyId,
          name: professional_name
        },
        attributes: [
          "id",
          "schedules",
          "appointmentSpacing",
          "appointmentSpacingUnit"
        ],
        include: [
          {
            model: Services,
            through: { attributes: [] },
            ...(service_name && {
              where: {
                name: {
                  [Op.iLike]: `%${service_name}%` // Filtro aplicado apenas se service_name existir
                }
              }
            }),
            attributes: ["id", "name", "description", "price", "duration"]
          }
        ]
        // order: [["createdAt", "ASC"]]
      });

      if (!user) {
        return "Profissional não encontrado.";
      }
    } else {
      const usersFound = await User.findAll({
        where: { profile: "professional", companyId },
        attributes: [
          "id",
          "schedules",
          "appointmentSpacing",
          "appointmentSpacingUnit"
        ],
        order: [["createdAt", "ASC"]]
      });
      if (usersFound.length > 1) {
        console.error("É necessario");
        return "É necessário informar o profissional_name pois há diversos profissionais cadastrados.";
      }
      user = usersFound[0];

      if (!user) {
        return "Nenhum profissional disponível.";
      }
    }

    const weekday = format(sendAt, "EEEE", { locale: ptBR }).toLowerCase();
    const hour = format(sendAt, "HH:mm");

    console.log("[OPENAI FUNCTION SCHEDULE] ➡️ Weekday:", weekday);
    console.log("[OPENAI FUNCTION SCHEDULE] ➡️ Hour:", hour);

    const scheduleDay = user.schedules.find(
      (s: any) => s.weekday.toLowerCase() === weekday
    );

    console.log("[OPENAI FUNCTION SCHEDULE] 📅 Schedule Day:", scheduleDay);

    if (!scheduleDay || scheduleDay.startTime === scheduleDay.endTime) {
      console.log(
        "[OPENAI FUNCTION SCHEDULE] ❌ Profissional não atende neste dia."
      );
      return "❌ Profissional não atende neste dia.";
    }

    if (hour < scheduleDay.startTime || hour > scheduleDay.endTime) {
      console.log(
        `[OPENAI FUNCTION SCHEDULE] ❌ Profissional atende apenas entre ${scheduleDay.startTime} e ${scheduleDay.endTime}.`
      );
      return `❌ Profissional atende apenas entre ${scheduleDay.startTime} e ${scheduleDay.endTime}.`;
    }

    let intervalInMinutes;
    let serviceId;

    if (service_name) {
      const service = user.services?.find(
        (s: any) => s.name.toLowerCase() === service_name.toLowerCase()
      );
      console.log(
        "[OPENAI FUNCTION SCHEDULE] 🔎 Serviço encontrado:",
        service?.name
      );

      if (service) {
        intervalInMinutes = service.duration;
        serviceId = service.id;
      } else {
        console.log(
          "[OPENAI FUNCTION SCHEDULE] ❌ Serviço informado não foi encontrado para este profissional."
        );
        return "❌ Serviço informado não foi encontrado para este profissional.";
      }
    } else {
      if (user.appointmentSpacingUnit === "hours") {
        intervalInMinutes = user.appointmentSpacing * 60;
      } else if (user.appointmentSpacingUnit === "min") {
        intervalInMinutes = user.appointmentSpacing;
      } else {
        console.log(
          "[OPENAI FUNCTION SCHEDULE] ❌ Unidade de espaçamento inválida."
        );
        return "❌ Unidade de espaçamento inválida. Use 'min' ou 'hours'.";
      }
    }

    console.log(
      "[OPENAI FUNCTION SCHEDULE] ⏳ Intervalo em minutos:",
      intervalInMinutes
    );

    const conflictingAppointments = await Appointment.findAll({
      where: {
        userId: user.id,
        status: { [Op.ne]: "cancelled" },
        [Op.or]: [
          {
            scheduledDate: moment(sendAt).format("YYYY-MM-DD HH:mm:ss")
          },
          {
            scheduledDate: {
              [Op.gt]: moment(sendAt)
                .subtract(intervalInMinutes, "minutes")
                .format("YYYY-MM-DD HH:mm:ss")
            }
          },
          {
            scheduledDate: {
              [Op.gt]: moment().format("YYYY-MM-DD HH:mm:ss")
            }
          }
        ]
      },
      order: [["scheduledDate", "ASC"]]
    });

    if (conflictingAppointments.length > 0) {
      let scheduledTimes: { start: any; end: any }[] = [];

      for (const appointment of conflictingAppointments) {
        const appointmentStart = moment(appointment.scheduledDate);
        const appointmentEnd = appointmentStart
          .clone()
          .add(intervalInMinutes, "minutes");

        scheduledTimes.push({ start: appointmentStart, end: appointmentEnd });
      }

      scheduledTimes.sort((a, b) => a.start.diff(b.start));
      // Geração de horários disponíveis de 1 em 1 minuto entre 09:00 e 20:00
      let allAvailableTimes: string[] = [];
      let allOccupiedTimes: string[] = [];

      let workStartTime = moment(
        `${moment(sendAt).format("YYYY-MM-DD")} ${scheduleDay.startTime}`,
        "YYYY-MM-DD HH:mm"
      );
      let workEndTime = moment(
        `${moment(sendAt).format("YYYY-MM-DD")} ${scheduleDay.endTime}`,
        "YYYY-MM-DD HH:mm"
      );

      let currentSlot = workStartTime.clone();

      while (currentSlot.isBefore(workEndTime)) {
        let nextSlotEnd = currentSlot.clone().add(intervalInMinutes, "minutes");

        if (nextSlotEnd.isAfter(workEndTime)) break;

        let hasConflict = scheduledTimes.some(
          slot =>
            currentSlot.isBefore(slot.end) && nextSlotEnd.isAfter(slot.start)
        );

        if (!hasConflict) {
          allAvailableTimes.push(currentSlot.format("YYYY-MM-DD HH:mm:ss"));
        } else {
          allOccupiedTimes.push(currentSlot.format("YYYY-MM-DD HH:mm:ss"));
        }

        // Avança de 1 em 1 minuto para verificar todas as possibilidades
        currentSlot = currentSlot.add(1, "minutes");
      }

      // Verifica se o horário solicitado faz parte dos horários livres
      const requestedTimeFormatted = moment(sendAt).format(
        "YYYY-MM-DD HH:mm:ss"
      );

      if (!allAvailableTimes.includes(requestedTimeFormatted)) {
        // Filtra horários disponíveis para exibir de 5 em 5 minutos
        const suggestedTimes = allAvailableTimes.filter(time => {
          const minutes = moment(time).minute();
          return minutes % 5 === 0;
        });

        return `❌ O horário solicitado (${requestedTimeFormatted}) não está disponível.
  🔎 Horários disponíveis de 5 em 5 minutos:
  - ${suggestedTimes.join("\n- ")}`;
      }

      console.log(
        `[DEBUG] ✅ O horário solicitado (${requestedTimeFormatted}) está disponível.`
      );
    }

    console.log(
      "[OPENAI FUNCTION SCHEDULE] ✅ Nenhum conflito encontrado. Horário disponível:",
      moment(sendAt).format("YYYY-MM-DD HH:mm:ss")
    );

    const newSchedule = {
      body: message,
      body_first_aux: message_first_aux ?? "",
      body_second_aux: message_second_aux ?? "",
      sendAt,
      sendAt_first_aux,
      sendAt_second_aux,
      contactId,
      companyId,
      userId: user.id
    };

    const createdSchedule = await CreateService(newSchedule, true);

    const newAppointment = await Appointment.create({
      userId: user.id,
      ticketId: ticketId,
      serviceId,
      scheduledDate: sendAt,
      description: message,
      status: "pending",
      companyId: companyId
    });

    newAppointment.save();

    const io = getIO();

    io.to(`company-${companyId}-mainchannel`).emit("schedule", {
      action: "create",
      schedule: createdSchedule
    });

    return "true";
  } catch (error) {
    logger.error("schedule -> error", error);
    console.log("-------");
    console.dir(error);
    console.log("-------");
    return "false";
  }
};

// const schedule = async (payload: any, accountInfo: any) => {
//   try {
//     const { date, message, message_one_hour, message_teen_min, profissional_name, professional_name, serviceId } = payload;
//     const { contactId, companyId, userId, ticketId } = accountInfo;

//     console.log("[DEBUG schedule]")
//     console.table({ date, message, message_one_hour, message_teen_min, professional_name,  serviceId })

//     const sendAt = addHours(parseISO(date), 3);

//     if (isBefore(sendAt, new Date())) {
//       const invalidDate = format(sendAt, "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
//       const currentDate = format(new Date(), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
//       return `Não é possível agendar para o passado. Data informada: ${invalidDate}. Data atual: ${currentDate}`;
//     }

//     let user: any = null;

//     if (profissional_name || professional_name) {
//       user = await User.findOne({
//         where: { profile: "professional", companyId, name: professional_name },
//         attributes: ["id", "schedules", "appointmentSpacing", "appointmentSpacingUnit"],
//         order: [["createdAt", "ASC"]]
//       });

//       console.log("[DEBUG schedule]")
//       console.log(user)
//       if (!user) {
//         return "Profissional não encontrado.";
//       }
//     } else {
//       const usersFound = await User.findAll({
//         where: { profile: "professional", companyId },
//         attributes: ["id", "schedules", "appointmentSpacing", "appointmentSpacingUnit"],
//         order: [["createdAt", "ASC"]]
//       });
//       if (usersFound.length > 1) {
//         console.error("É necessario");
//         return "É necessário informar o profissional_name pois há diversos profissionais cadastrados.";
//       }
//       user = usersFound[0]

//       if (!user) {
//         return "Nenhum profissional disponível.";
//       }
//     }

//     const weekday = format(sendAt, "EEEE", { locale: ptBR }).toLowerCase();
//     const hour = format(sendAt, "HH:mm",);

//     const scheduleDay = user.schedules.find((s: any) => s.weekday.toLowerCase() === weekday);

//     // ✅ Verifica se o profissional atende no dia e horário informado
//     if (!scheduleDay || scheduleDay.startTime === scheduleDay.endTime) {
//       return "❌ Profissional não atende neste dia.";
//     }

//     if (hour < scheduleDay.startTime || hour > scheduleDay.endTime) {
//       return `Profissional atende apenas entre ${scheduleDay.startTime} e ${scheduleDay.endTime}.`;
//     }

//     let nextAvailableTime;
//     if (user.appointmentSpacingUnit === "hours") {
//       nextAvailableTime = moment(sendAt).add(user.appointmentSpacing, "hours").format("YYYY-MM-DD HH:mm:ss");
//     } else if (user.appointmentSpacingUnit === "min") {
//       nextAvailableTime = moment(sendAt).add(user.appointmentSpacing, "minutes").format("YYYY-MM-DD HH:mm:ss");
//     } else {
//       return "Unidade de espaçamento inválida. Use 'min' ou 'hours'.";
//     }

//     const conflictingAppointment = await Appointment.findOne({
//       where: {
//         userId: user.id,
//         status: { [Op.ne]: "cancelled" },
//         [Op.or]: [
//           {
//             scheduledDate: moment(sendAt).format("YYYY-MM-DD HH:mm:ss")
//           },
//           {
//             scheduledDate: {
//               [Op.gt]: moment(sendAt).subtract(user.appointmentSpacing, user.appointmentSpacingUnit).format("YYYY-MM-DD HH:mm:ss"),
//               [Op.lt]: nextAvailableTime // Dentro do intervalo de espaçamento
//             }
//           }
//         ]
//       }
//     });

//     if (conflictingAppointment) {
//       const conflictTime = format(conflictingAppointment.scheduledDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
//       return `Horário já ocupado até ${conflictTime}.`;
//     }

//     if (conflictingAppointment) {
//       const conflictTime = format(conflictingAppointment.scheduledDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
//       return `Horário já ocupado até ${conflictTime}.`;
//     }

//     const newSchedule = {
//       body: message,
//       body_one_hour: message_one_hour ?? "",
//       body_ten_min: message_teen_min ?? "",
//       sendAt,
//       contactId,
//       companyId,
//       userId: user.id
//     };

//     const createdSchedule = await CreateService(newSchedule, true);

//     const newAppointment = await Appointment.create({
//       userId: user.id,
//       ticketId: ticketId,
//       serviceId: serviceId,
//       scheduledDate: sendAt,
//       description: message,
//       status: "pending",
//       companyId: companyId
//     });

//     newAppointment.save()

//     const io = getIO();

//     io.to(`company-${companyId}-mainchannel`).emit("schedule", {
//       action: "create",
//       schedule: createdSchedule
//     });

//     return "true";
//   } catch (error) {
//     logger.error("schedule -> error", error?.message);
//     return "false";
//   }
// };

const cancel_schedule = async (payload: any, accountInfo: any) => {
  try {
    const { date } = payload;

    const { contactId, companyId, ticketId } = accountInfo;

    // ✅ Ajuste manual do fuso horário para São Paulo (+3 horas)
    const sendAt = addHours(parseISO(date), 3);

    // ✅ Verifica se existe um agendamento correspondente no Appointment
    const appointment = await Appointment.findOne({
      where: {
        ticketId,
        scheduledDate: sendAt
      }
    });

    console.log("-------");
    console.log("[DEBUG - CANCEL SCHEDULE]", payload, appointment);
    console.log("-------");

    if (!appointment) {
      return `❌ Nenhum agendamento encontrado para essa data.
       Data Atual: ${get_current_date()}
      `;
    }

    // ✅ Atualiza o status do Appointment para "cancelled"
    appointment.status = "cancelled";
    await appointment.save();

    // ✅ Cancela no serviço de agendamento (CancelService)
    const canceledSchedule = await CancelService({
      sendAt,
      contactId,
      companyId
    });

    // ✅ Notifica via WebSocket
    const io = getIO();
    io.to(`company-${companyId}-mainchannel`).emit("schedule", {
      action: "cancel",
      schedule: canceledSchedule,
      appointment: appointment
    });

    return `true
     Data Atual: ${get_current_date()}
    `;
  } catch (error) {
    console.log("[ERROR]", error);
    logger.error("cancel_schedule openai -> error", error?.message ?? error);
    return "false";
  }
};

const check_schedules = async (
  payload: any,
  accountInfo: any
): Promise<string> => {
  try {
    let currentDate = moment().format();
    const { ticketId, companyId } = accountInfo;

    const appointments = await Appointment.findAll({
      where: {
        ticketId,
        scheduledDate: { [Op.gt]: currentDate }
      },
      include: [
        {
          model: Services,
          as: "service",
          attributes: ["name"]
        },
        {
          model: User,
          as: "user",
          attributes: ["name"]
        }
      ],
      attributes: ["id", "scheduledDate", "status", "description"]
    });

    if (appointments.length === 0) {
      return `### ❌ Você não possui agendamentos.
       Data Atual: ${get_current_date()}
      `;
    }

    const markdownAppointments = appointments
      .map(
        (appointment: any) => `- **Data:** ${moment(
          appointment.scheduledDate
        ).format("DD/MM/YYYY HH:mm")}
  - **Status:** ${appointment.status}
  - **Serviço:** ${appointment.service?.name || "Não informado"}
  - **Profissional:** ${appointment.user?.name || "Não informado"}
  - **Descrição:** ${appointment.description || "Nenhuma"}`
      )
      .join("\n\n");

    return `### 📅 Seus Agendamentos\n\n${markdownAppointments}
     Data Atual: ${get_current_date()}
    `;
  } catch (error) {
    console.log("[ERROR]", error);
    logger.error("check_schedules -> error", error?.message ?? error);
    return `### ❌ Erro ao verificar os seus agendamentos.
     Data Atual: ${get_current_date()}
    `;
  }
};

const request_scheduling_link = async (payload: any, accountInfo: any) => {
  const { ticketId, companyId } = accountInfo;

  return `https://agenda.tzsacademy.com/services/${companyId}?ticketId=${ticketId}
   Data Atual: ${get_current_date()}
  `;
};

const get_day_of_week = async (
  payload: any,
  accountInfo: any
): Promise<string> => {
  try {
    const { date } = payload;

    if (!date) {
      console.error("get_day_of_week -> Missing date in payload");
      return "Data inválida";
    }

    const daysOfWeek = [
      "Domingo",
      "Segunda-feira",
      "Terça-feira",
      "Quarta-feira",
      "Quinta-feira",
      "Sexta-feira",
      "Sábado"
    ];

    let adjustedDate = addHours(parseISO(date), 3);
    adjustedDate = setHours(adjustedDate, 6);
    adjustedDate = setMinutes(adjustedDate, 0);
    adjustedDate = setSeconds(adjustedDate, 0);

    const dayIndex = adjustedDate.getDay();

    return `${daysOfWeek[dayIndex]}
     Data Atual: ${get_current_date()}
    `;
  } catch (error) {
    console.error("get_day_of_week -> error", error?.message);
    return "Data inválida";
  }
};

const get_office_hours = async (
  payload: any,
  accountInfo: any
): Promise<string> => {
  try {
    const { serviceId } = payload;
    const { companyId } = accountInfo;

    const professionals = await User.findAll({
      where: { profile: "professional", companyId },
      attributes: ["id", "schedules"]
    });

    if (professionals.length === 0) {
      console.error("Nenhum profissional cadastrado para a empresa.");
      return `### ❌ Nenhum profissional cadastrado.
       Data Atual: ${get_current_date()}
      `;
    }

    let user: User | null = null;

    if (professionals.length === 1) {
      user = professionals[0];
    } else {
      if (!serviceId) {
        console.error("Serviço não informado para múltiplos profissionais.");
        return `### ⚠️ É necessário informar o serviço para identificar o profissional.
         Data Atual: ${get_current_date()}
        `;
      }

      const userService = await UserServices.findOne({
        where: { serviceId }
      });

      if (!userService) {
        console.error("Serviço não vinculado a nenhum profissional.");
        return `### ❌ Serviço não vinculado a nenhum profissional.
         Data Atual: ${get_current_date()}
        `;
      }

      user = await User.findOne({
        where: { id: userService.userId, profile: "professional", companyId },
        attributes: ["id", "schedules"]
      });

      if (!user) {
        console.error("Profissional não encontrado para o serviço informado.");
        return `### ❌ Profissional não encontrado para o serviço informado.
         Data Atual: ${get_current_date()}
        `;
      }
    }

    if (user && user.schedules && user.schedules.length > 0) {
      const markdownSchedules = user.schedules
        .map((s: any) => {
          if (s.startTime === s.endTime) {
            return `- **${s.weekday}**: Fechado`;
          }
          return `- **${s.weekday}**: ${s.startTime} - ${s.endTime}`;
        })
        .join("\n");

      return `### 🗓️ Horários de Atendimento\n\n${markdownSchedules}
       Data Atual: ${get_current_date()}
      `;
    }

    console.error("Horários não encontrados para o profissional.");
    return `### ❌ Horários não encontrados para o profissional.
     Data Atual: ${get_current_date()}
    `;
  } catch (error) {
    console.error("get_office_hours -> error", error?.message);
    return `### ❌ Erro ao buscar horários de atendimento.
     Data Atual: ${get_current_date()}
    `;
  }
};

const list_available_services = async (
  payload: any,
  accountInfo: any
): Promise<string> => {
  try {
    const { companyId } = accountInfo;

    const services = await Services.findAll({
      where: { companyId },
      attributes: ["id", "name"]
    });

    if (services.length === 0) {
      console.error("Nenhum serviço encontrado para a empresa.");
      return `Nenhum serviço disponível para esta empresa.
       Data Atual: ${get_current_date()}
      `;
    }

    const markdownServices = services
      .map((service: any) => `- **${service.name}** (ID: ${service.id})`)
      .join("\n");

    return `### 📋 Serviços Disponíveis\n\n${markdownServices}
     Data Atual: ${get_current_date()}
    `;
  } catch (error) {
    console.error("list_available_services -> error", error?.message);
    return `Erro ao listar os serviços disponíveis.
     Data Atual: ${get_current_date()}
    `;
  }
};

const get_service_professionals = async (
  payload: any,
  accountInfo: any
): Promise<string> => {
  try {
    const { service_name } = payload;
    const { companyId } = accountInfo;

    let professionals;

    if (service_name) {
      const userServices = await UserServices.findAll({
        include: [
          {
            model: Service,
            as: "service",
            where: { name: service_name }
          }
        ],
        attributes: ["userId"]
      });

      if (userServices.length === 0) {
        console.error("Nenhum profissional vinculado a este serviço.");
        return `Nenhum profissional vinculado a este serviço.
         Data Atual: ${get_current_date()}
        `;
      }

      const userIds = userServices.map((us: any) => us.userId);

      professionals = await User.findAll({
        where: { id: userIds, profile: "professional", companyId },
        attributes: ["id", "name", "schedules"]
      });
    } else {
      professionals = await User.findAll({
        where: { profile: "professional", companyId },
        attributes: ["id", "name", "schedules"]
      });

      if (professionals.length === 0) {
        console.error("Nenhum profissional cadastrado para a empresa.");
        return `"Nenhum profissional cadastrado.
         Data Atual: ${get_current_date()}
        `;
      }
    }

    const markdownProfessionals = professionals
      .map((prof: any) => {
        const schedules = prof.schedules
          .map(
            (s: any) => `  - **${s.weekday}**: ${s.startTime} - ${s.endTime}`
          )
          .join("\n");
        return `- **${prof.name}**:\n${schedules}`;
      })
      .join("\n\n");

    return `### 👩‍⚕️ Profissionais para o serviço **${
      service_name || "Todos"
    }**\n\n${markdownProfessionals}
     Data Atual: ${get_current_date()}
    `;
  } catch (error) {
    console.error("get_service_professionals -> error", error?.message);
    return `Erro ao buscar profissionais.
     Data Atual: ${get_current_date()}
    `;
  }
};


export {
  check_schedules,
  check_calendar,
  get_day_of_week,
  get_office_hours,
  schedule,
  cancel_schedule,
  get_current_date,
  find_customer,
  register_customer,
  request_scheduling_link,
  list_available_services,
  get_service_professionals,
  
};
