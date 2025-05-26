import Schedule from "../../models/Schedule";
import AppError from "../../errors/AppError";
import { Op } from "sequelize";


interface Request {
  sendAt: string;
  contactId: number | string;
  companyId: number | string;
  userId?: number | string;
}

const CancelService = async ({
  sendAt,
  contactId,
  companyId,
  userId = null
}: Request): Promise<void> => {
  const schedule = await Schedule.findOne({
    where: { [Op.or]: [{ sendAt, contactId, userId, companyId }, { sendAt, contactId, companyId }] }
  });

  if (!schedule) {
    throw new AppError("ERR_NO_SCHEDULE_FOUND", 404);
  }

  await schedule.destroy();
};

export default CancelService;
