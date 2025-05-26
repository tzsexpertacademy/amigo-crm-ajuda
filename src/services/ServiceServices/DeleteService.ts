import Service from "../../models/Service";
import AppError from "../../errors/AppError";

const DeleteServiceService = async (
  serviceId: string | number,
  userId: number
): Promise<void> => {
  const service = await Service.findOne({
    where: { id: serviceId }
  });

  if (!service) {
    throw new AppError("ERR_NO_SERVICE_FOUND", 404);
  }

  await service.destroy();
};

export default DeleteServiceService;
