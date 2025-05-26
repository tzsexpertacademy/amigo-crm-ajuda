import User from "../../models/User";
import AppError from "../../errors/AppError";
import Queue from "../../models/Queue";
import Company from "../../models/Company";
import Whatsapp from "../../models/Whatsapp";
import UserServices from "../../models/UserServices";

const ShowUserService = async (id: string | number, plain: boolean = false): Promise<User | any> => {
  const user = await User.findByPk(id, {
    attributes: [
      "name",
      "id",
      "email",
      "profession",
      "appointmentSpacing",
      "appointmentSpacingUnit",
      "schedules",
      "companyId",
      "profile",
      "body",
      "body_one_hour",
      "body_ten_min",
      "super",
      "tokenVersion",
      "whatsappId", 
      "allTicket"
    ],
    include: [
      { model: Queue, as: "queues", attributes: ["id", "name", "color"] },
      { model: Company, as: "company", attributes: ["id", "name"] },
      {
        model: Whatsapp,
        as: "whatsapps"
      }
    ]
  });

  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  // Se o usuário for um profissional, busca os serviços associados
  if (user.profile === "professional") {
    const foundUserServices = await UserServices.findAll({
      where: { userId: user.id },
      attributes: ["serviceId"],
    });

    // Extrai apenas os IDs dos serviços
    const serviceIds = foundUserServices.map(service => service.serviceId);

    if (plain) {
      return {
        ...user.get({ plain: true }),
        profissionalService: serviceIds.length > 0 ? serviceIds : null,
      };
    } else {
      return user;
    }
  }

  return plain ? user.get({ plain: true }) : user;
};



export default ShowUserService;
