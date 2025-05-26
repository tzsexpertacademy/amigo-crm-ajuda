import * as Yup from "yup";

import AppError from "../../errors/AppError";
import { SerializeUser } from "../../helpers/SerializeUser";
import User from "../../models/User";
import Plan from "../../models/Plan";
import Company from "../../models/Company";
import UserServices from "../../models/UserServices";
import Service from "../../models/Service";

interface Request {
  email: string;
  password: string;
  name: string;
  queueIds?: number[];
  companyId?: number;
  profissionalService?: number[];
  profile?: string;
  body?: string;
  body_one_hour?: string;
  body_ten_min?: string;
  whatsappId?: number;
  allTicket?:string;
  profession?:string,
  appointmentSpacing?:string,
  appointmentSpacingUnit?:string,
  schedules: any[]
}

interface Response {
  email: string;
  name: string;
  id: number;
  profile: string; 
}

const CreateUserService = async ({
  email,
  password,
  name,
  queueIds = [],
  companyId,
  profile = "admin",
  body='',
  body_one_hour='',
  body_ten_min='',
  whatsappId,
  allTicket,
  profissionalService = null, // ProfissionalService pode ser null
  profession = null,
  appointmentSpacing = null,
  appointmentSpacingUnit = null,
  schedules = []
}: Request): Promise<Response> => {
  if (companyId !== undefined) {
    const company = await Company.findOne({
      where: {
        id: companyId
      },
      include: [{ model: Plan, as: "plan" }]
    });

    if (company !== null) {
      const usersCount = await User.count({
        where: {
          companyId
        }
      });

      if (usersCount >= company.plan.users) {
        throw new AppError(
          `Número máximo de usuários já alcançado: ${usersCount}`
        );
      }
    }
  }

  const schema = Yup.object().shape({
    name: Yup.string().required().min(2),
    email: Yup.string()
      .email()
      .required()
      .test(
        "Check-email",
        "An user with this email already exists.",
        async value => {
          if (!value) return false;
          const emailExists = await User.findOne({
            where: { email: value }
          });
          return !emailExists;
        }
      ),
    password: Yup.string().required().min(5)
  });

  try {
    await schema.validate({ email, password, name });
  } catch (err) {
    throw new AppError(err.message);
  }

  // Cria o usuário
  const user = await User.create(
    {
      email,
      password,
      name,
      companyId,
      profile,
      whatsappId: whatsappId || null,
      allTicket,
      profession,
      body,
      body_one_hour,
      body_ten_min,
      appointmentSpacing,
      appointmentSpacingUnit,
      schedules 
    },
    { include: ["queues", "company"] }
  );

  await user.$set("queues", queueIds);

  // Verifica e cria a relação com os serviços profissionais
  if (profissionalService) {
    const services = Array.isArray(profissionalService)
      ? profissionalService
      : [profissionalService]; // Permitir múltiplos serviços

    await Promise.all(
      services.map(async serviceId => {
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

  await user.reload();

  const serializedUser = SerializeUser(user);

  return serializedUser;
};

export default CreateUserService;
