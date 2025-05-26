import * as Yup from "yup";

import AppError from "../../errors/AppError";
import User from "../../models/User";
import Service from "../../models/Service";

interface Request {
  name: string;
  description: string;
  price: number;
  duration: number;
  companyId: any,
  userId: any
}

interface Response {
  id: number;
  name: string;
  description: string;
  price: number;
  duration: number;
}

const CreateServiceService = async ({
  name,
  description,
  price,
  duration,
  companyId,
  userId
}: Request): Promise<Response> => {

  const schema = Yup.object().shape({
    name: Yup.string().required(),
    description: Yup.string().required(),
    price: Yup.number().required().min(0),
    duration: Yup.number().required(),
  });

  try {
    await schema.validate({ name, description, price, duration, companyId, userId });
  } catch (err) {
    console.log("[ERROR CreateServiceService] - ", err)
    throw new AppError(err.message);
  }

  const service = await Service.create({
    name,
    description,
    price,
    duration,
    companyId, 
    userId
  });

  return service;
};

export default CreateServiceService;
