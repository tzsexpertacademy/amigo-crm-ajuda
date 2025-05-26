import express from "express";
import isAuth from "../middleware/isAuth";

import * as ContactController from "../controllers/ContactController";
import * as ImportPhoneContactsController from "../controllers/ImportPhoneContactsController";
import { cacheMiddlewareContactId } from "../middleware/cacheMid";
import multer from "multer";
import AppError from "../errors/AppError";

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb: (error: Error | null, acceptFile: boolean) => void) => {
    if (!file.originalname.match(/\.(xls|xlsx|csv)$/)) {
      return cb(new Error("Only spreadsheet files are allowed") as Error, false);
    }
    cb(null, true);
  },
});

const contactRoutes = express.Router();

contactRoutes.post(
  "/contacts/import",
  isAuth,
  ImportPhoneContactsController.store
);

contactRoutes.get("/contacts", isAuth, ContactController.index);

contactRoutes.get("/contacts/list", isAuth, ContactController.list);

contactRoutes.get("/contacts/:contactId", isAuth, ContactController.show);

contactRoutes.post("/contacts", isAuth, ContactController.store);
// @ts-ignore
contactRoutes.post("/contacts/upload", isAuth, upload.single("file"), ContactController.importContacts);

contactRoutes.put("/contacts/:contactId", isAuth, ContactController.update);

contactRoutes.delete("/contacts/:contactId", isAuth, ContactController.remove);

export default contactRoutes;
  