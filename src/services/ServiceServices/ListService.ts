import User from "../../models/User";
import AppError from "../../errors/AppError";
import Services from "../../models/Service";
// import User from "../../models/User";
import { Sequelize, Op } from "sequelize";

interface Request {
  searchParam?: string;
  noLimit?: string;
  pageNumber?: string | number;
  profile?: string;
  companyId?: number;
}

interface Response {
  services: Services[];
  count: number;
  hasMore: boolean;
}

const ListService = async (): Promise<Services[]> => {
  try {
    const services = await Services.findAll({
      include: [
        {
          model: User,
          attributes: ["id", "name"],
          through: { attributes: [] }, // Exclui os campos intermediários da tabela UserServices
        },
      ],
    });
    return services;
  } catch (error) {
    console.error("Erro ao buscar serviços com usuários:", error);
    throw error;
  }
};

const ListServiceV2 = async ({
  searchParam = "",
  pageNumber = "1",
  companyId,
  noLimit = null
}: Request): Promise<Response> => {
  const whereCondition = {
    [Op.or]: [
      {
        "$Services.name$": Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("Services.name")),
          "LIKE",
          `%${searchParam.toLowerCase()}%`
        )
      },
      { description: { [Op.like]: `%${searchParam.toLowerCase()}%` } }
    ],
    companyId: {
      [Op.eq]: companyId
    }
  };

  const limit = noLimit ? undefined : 20;
  const offset = limit ? limit * (+pageNumber - 1) : undefined;

  const { count, rows: services } = await Services.findAndCountAll({
    where: whereCondition,
    attributes: ["id", "name", "description", "price", "duration", "createdAt", "updatedAt"],
    ...(limit && { limit, offset }),
    order: [["createdAt", "DESC"]],
    include: [
      { model: User, as: "users", attributes: ["id", "name", "schedules"] },
    ]
  });

  const hasMore = noLimit ? false : (limit ? count > offset + services.length : false);

  return {
    services,
    count,
    hasMore
  };
};



export  {ListService, ListServiceV2};
 