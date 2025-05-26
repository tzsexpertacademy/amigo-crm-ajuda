import * as Yup from "yup";

import AppError from "../../errors/AppError";
import ShowUserService from "./ShowUserService";
import Company from "../../models/Company";
import User from "../../models/User";
import UserServices from "../../models/UserServices";
import Service from "../../models/Service";
import Queue from "../../models/Queue";

interface UserData {
  email?: string;
  password?: string;
  name?: string;
  profile?: string;
  body?: string,
  body_one_hour?: string,
  body_ten_min?: string,
  companyId?: number;
  profissionalService?: number[];
  queueIds?: number[];
  whatsappId?: number;
  allTicket?: string;
  profession?: string,
  appointmentSpacing?: string,
  appointmentSpacingUnit?: string,
  schedules: any[]
}

interface Request {
  userData: UserData;
  userId: string | number;
  companyId: number;
  requestUserId: number;
}

interface Response {
  id: number;
  name: string;
  email: string;
  profile: string;
}

const UpdateUserService = async ({
  userData,
  userId,
  companyId,
  requestUserId
}: Request): Promise<Response | undefined> => {
  const user = await ShowUserService(userId);

  const requestUser = await User.findByPk(requestUserId);

  if (requestUser.super === false && userData.companyId !== companyId) {
    throw new AppError("O usuário não pertence à esta empresa");
  }

  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    email: Yup.string().email(),
    profile: Yup.string(),
    password: Yup.string(),
    allTicket: Yup.string(),
  });

  const {
    email,
    password,
    profile,
    name,
    queueIds = [],
    whatsappId,
    profissionalService,
    profession,
    appointmentSpacing,
    appointmentSpacingUnit,
    schedules,
    body,
    body_one_hour,
    body_ten_min,
  } = userData;

  const allTicket = userData?.allTicket ?? "desabled"

  try {
    console.log("[VALIDANDO SCHEMA IN UPDATE USER] - ", email, password, profile, name, allTicket, profissionalService )
    await schema.validate({ email, password, profile, name, allTicket, profissionalService });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  // Atualiza os dados do usuário
  await user.update({
    email,
    password,
    profile,
    name,
    whatsappId: whatsappId || null,
    allTicket,
    profession,
    body,
    body_one_hour,
    body_ten_min,
    appointmentSpacing,
    appointmentSpacingUnit,
    schedules
  });

  // Atualiza as filas associadas
  await user.$set("queues", queueIds);

  // Atualiza ou cria a relação com UserServices
  if (user.profile === "professional") {
    // Remove serviços antigos
    await UserServices.destroy({
      where: { userId: user.id }
    });

    const services = Array.isArray(profissionalService)
      ? profissionalService
      : [profissionalService];

    // Adiciona os novos serviços
    await Promise.all(
      services.map(async (serviceId) => {
        const serviceExists = await Service.findByPk(serviceId);
        if (!serviceExists) {
          throw new AppError(`Serviço com ID ${serviceId} não encontrado.`);
        }
        await UserServices.create({
          userId: user.id,
          serviceId
        });
      })
    );
  }

  await user.reload({
    include: [
      { model: Queue, as: "queues", attributes: ["id", "name", "color"] },
      { model: Company, as: "company", attributes: ["id", "name"] },
      {
        model: Service,
        as: "services",
        attributes: ["id", "name", "description"]
      }
    ]
  });

  const company = await Company.findByPk(user.companyId);

  // Inclui serviços profissionais no retorno
  const updatedUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    companyId: user.companyId,
    company,
    queues: user.queues,
    services: user.services
  };

  return updatedUser;
};


export default UpdateUserService;
