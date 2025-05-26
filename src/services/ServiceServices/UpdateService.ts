import * as Yup from "yup";

import AppError from "../../errors/AppError";
import Service from "../../models/Service";

interface ServiceData {
  name?: string;
  description?: string;
  price?: number;
  duration?: number;
}

interface Request {
  serviceData: ServiceData;
  serviceId: string | number;
  requestUserId: number;
}

interface Response {
  id: number;
  name: string;
  description: string;
  price: number;
  duration: number;
}

const UpdateServiceService = async ({
  serviceData,
  serviceId,
  requestUserId
}: Request): Promise<Response | undefined> => {
  const service = await Service.findByPk(serviceId);

  if (!service) {
    throw new AppError("Service not found", 404);
  }

  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    description: Yup.string().min(5),
    price: Yup.number().min(0),
    duration: Yup.number().min(1)
  });

  const { name, description, price, duration } = serviceData;

  try {
    await schema.validate({ name, description, price, duration });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await service.update({
    name,
    description,
    price,
    duration
  });

  await service.reload();

  const serializedService = {
    id: service.id,
    name: service.name,
    description: service.description,
    price: service.price,
    duration: service.duration
  };

  return serializedService;
};

export default UpdateServiceService;
