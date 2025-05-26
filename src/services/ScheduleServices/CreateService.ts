import * as Yup from "yup";

import AppError from "../../errors/AppError";
import Schedule from "../../models/Schedule";

interface Request {
  contactId: number | string;
  body: string;
  body_first_aux?: string;
  body_second_aux?: string;
  sendAt: string;
  sendAt_first_aux?: string;
  sendAt_second_aux?: string;
  sentAt?: string;
  sentAt_first_aux?: string;
  sentAt_second_aux?: string;
  companyId: number | string;
  userId?: number | string;
}

const CreateService = async (
  {
    contactId,
    body,
    body_first_aux = "",
    body_second_aux = "",
    sendAt,
    sendAt_first_aux = "",
    sendAt_second_aux = "",
    companyId,
    userId
  }: Request,
  isToCreateAppointment: boolean = false
): Promise<Schedule> => {
  const schema = Yup.object().shape({
    body: Yup.string().required().min(5),
    sendAt: Yup.string().required(),
    body_first_aux: Yup.string(),
    body_second_aux: Yup.string(),
    sendAt_first_aux: Yup.string(),
    sendAt_second_aux: Yup.string()
  });

  try {
    await schema.validate({
      body,
      sendAt,
      body_first_aux,
      body_second_aux,
      sendAt_first_aux,
      sendAt_second_aux
    });
  } catch (err: any) {
    console.log(err, "TESTE ERROR CREATE SCHEDULUE")
    throw new AppError(err.message);
  }

  const schedule = await Schedule.create({
    contactId,
    body,
    body_first_aux,
    body_second_aux,
    sendAt,
    sendAt_first_aux,
    sendAt_second_aux,
    companyId,
    userId,
    status: "PENDENTE"
  });

  await schedule.reload();

  return schedule;
};

export default CreateService;
