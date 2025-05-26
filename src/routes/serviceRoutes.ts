import { Router } from "express";

import isAuth from "../middleware/isAuth";
import * as ServiceController from "../controllers/ServiceController";

const serviceRoutes = Router();

serviceRoutes.get("/service/panel", isAuth, ServiceController.index); 

serviceRoutes.get("/services/:serviceId", ServiceController.show);

serviceRoutes.post("/services", isAuth, ServiceController.store);

serviceRoutes.put("/services/:serviceId", isAuth, ServiceController.update);

// Use uma rota clara para o show por `companyId`
serviceRoutes.get("/services/company/:companyId", ServiceController.showByCompany);

serviceRoutes.delete("/services/:serviceId", isAuth, ServiceController.remove);


export default serviceRoutes;
