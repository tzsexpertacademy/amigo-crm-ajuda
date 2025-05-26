import express from "express";
import isAuth from "../middleware/isAuth";
import isSuper from "../middleware/isSuper";
import AppointmentController from "../controllers/AppointmentController";

const routes = express.Router();

routes.get("/appointments", AppointmentController.index);

routes.get("/appointments/panel", isAuth, AppointmentController.indexV2);

// routes.get("/appointments/:id", AppointmentController.show);

routes.get("/appointments/panel/:id", isAuth, AppointmentController.show);
 
routes.get("/appointments/ticket/:ticketId", AppointmentController.showByTicket);

routes.patch("/appointments/cancell/:id", AppointmentController.cancell);

routes.post("/appointments", AppointmentController.store);

routes.put("/appointments/:id", AppointmentController.update);

routes.delete("/appointments/:id", isAuth, AppointmentController.delete);

export default routes;
 