import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import uploadConfig from "../config/upload";
import tokenAuth from "../middleware/tokenAuth";

import * as MessageController from "../controllers/MessageController";
import { cacheMiddleware } from "../middleware/cacheMid";
import { redisClient } from "../utils/redis";

const messageRoutes = Router();

const upload = multer(uploadConfig);

messageRoutes.get("/messages/:ticketId", isAuth, MessageController.index);
// @ts-ignore
messageRoutes.post("/messages/:ticketId", isAuth, upload.array("medias"), MessageController.store);
messageRoutes.delete("/messages/:messageId", isAuth, MessageController.remove);
// @ts-ignore
messageRoutes.post("/api/messages/send", tokenAuth, upload.array("medias"), MessageController.send);
messageRoutes.put("/api/contact/", tokenAuth, MessageController.updateContactServiceByApiInController);
messageRoutes.get("/messages/del", async (req, res) => { await redisClient.del('*'); return res.send() });

export default messageRoutes;
 