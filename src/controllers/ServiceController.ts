import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import AppError from "../errors/AppError";

import CreateServiceService from "../services/ServiceServices/CreateService";
// import ListServicesService from "../services/ServiceServices/ListService";
import UpdateServiceService from "../services/ServiceServices/UpdateService";
import ShowServiceService from "../services/ServiceServices/ShowServiceService";
import ShowServiceServiceByCompany from "../services/ServiceServices/ShowServiceServiceByCompany";
import DeleteServiceService from "../services/ServiceServices/DeleteService";
import {ListService, ListServiceV2} from "../services/ServiceServices/ListService";

type IndexQuery = {
  searchParam: string;
  noLimit: string;
  pageNumber: string;
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { name, description, price, duration } = req.body;
  const { companyId, id: userId } = req.user;

  console.log(req.user, "REQ USER")


  const service = await CreateServiceService({
    name,
    description,
    price,
    duration, 
    companyId, 
    userId
  });

  const io = getIO();
  io.to(`user-${userId}-mainchannel`).emit(`user-${userId}-service`, {
    action: "create",
    service
  });

  return res.status(200).json(service);
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber, noLimit } = req.query as IndexQuery;
  const { companyId, profile } = req.user;

  console.log(req.user, "REQ USER")

  const { services, count, hasMore } = await ListServiceV2({
    searchParam,
    pageNumber,
    companyId,
    profile, 
    noLimit
  });
 
  return res.json({ services, count, hasMore });
};

export const list = async (req: Request, res: Response): Promise<Response> => {
  const services = await ListService(); 

  return res.status(200).json(services);
};

export const showByCompany = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.params;

  const services = await ShowServiceServiceByCompany(companyId);

  return res.status(200).json(services);
}; 

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { serviceId } = req.params;

  const services = await ShowServiceService(serviceId);

  return res.status(200).json(services);
}; 

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { serviceId } = req.params;
  const serviceData = req.body;
  const userId = +req.user.id;

  const service = await UpdateServiceService({
    serviceData,
    serviceId,
    requestUserId: +userId
  });

  const io = getIO();
  io.to(`user-${userId}-mainchannel`).emit(`user-${userId}-service`, {
    action: "update",
    service
  });

  return res.status(200).json(service);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { serviceId } = req.params;
  const userId = +req.user.id;

  await DeleteServiceService(serviceId, userId);

  const io = getIO();
  io.to(`user-${userId}-mainchannel`).emit(`user-${userId}-service`, {
    action: "delete",
    serviceId
  });

  return res.status(200).json({ message: "Service deleted" });
};
