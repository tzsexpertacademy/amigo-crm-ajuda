import * as Yup from "yup";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import ListContactsService from "../services/ContactServices/ListContactsService";
import CreateContactService from "../services/ContactServices/CreateContactService";
import ShowContactService from "../services/ContactServices/ShowContactService";
import UpdateContactService from "../services/ContactServices/UpdateContactService";
import DeleteContactService from "../services/ContactServices/DeleteContactService";
import GetContactService from "../services/ContactServices/GetContactService";

import CheckContactNumber from "../services/WbotServices/CheckNumber";
import CheckIsValidContact from "../services/WbotServices/CheckIsValidContact";
import GetProfilePicUrl from "../services/WbotServices/GetProfilePicUrl";
import AppError from "../errors/AppError";
import SimpleListService, {
  SearchContactParams
} from "../services/ContactServices/SimpleListService";
import ContactCustomField from "../models/ContactCustomField";
import { createCache } from "../middleware/cacheMid";
import * as XLSX from "xlsx";


type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  limit?: string;
};

type IndexGetContactQuery = {
  name: string;
  number: string;
};

interface ExtraInfo extends ContactCustomField {
  name: string;
  value: string;
}
interface ContactData {
  name: string;
  number: string;
  email?: string;
  extraInfo?: ExtraInfo[];
}

interface RowData {
  Nome?: string;
  Telefone?: string;
  Email?: string;
  [key: string]: any;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber, limit } = req.query as IndexQuery;
  const { companyId } = req.user;

  console.log("[INDEX FIND CONTACT]", searchParam, pageNumber, limit);

  const { contacts, count, hasMore } = await ListContactsService({
    searchParam,
    pageNumber,
    companyId,
    limited: limit
  });

  return res.json({ contacts, count, hasMore });
};

export const getContact = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { name, number } = req.body as IndexGetContactQuery;
  const { companyId } = req.user;

  const contact = await GetContactService({
    name,
    number,
    companyId
  });

  return res.status(200).json(contact);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const newContact: ContactData = req.body;
  newContact.number = newContact.number.replace("-", "").replace(" ", "");

  const schema = Yup.object().shape({
    name: Yup.string().required(),
    number: Yup.string()
      .required()
      .matches(/^\d+$/, "Invalid number format. Only numbers is allowed.")
  });

  try {
    await schema.validate(newContact);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await CheckIsValidContact(newContact.number, companyId);
  const validNumber = await CheckContactNumber(newContact.number, companyId);
  const number = validNumber.jid.replace(/\D/g, "");
  newContact.number = number;

  /**
   * Código desabilitado por demora no retorno
   */
  // const profilePicUrl = await GetProfilePicUrl(validNumber.jid, companyId);

  const contact = await CreateContactService({
    ...newContact,
    // profilePicUrl,
    companyId
  });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
    action: "create",
    contact
  });

  return res.status(200).json(contact);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;

  const contact = await ShowContactService(contactId, companyId);
  if (contactId) {
    createCache(contactId, contact)
  }
  return res.status(200).json(contact);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const contactData: ContactData = req.body;
  const { companyId } = req.user;

  const schema = Yup.object().shape({
    name: Yup.string(),
    number: Yup.string().matches(
      /^\d+$/,
      "Invalid number format. Only numbers is allowed."
    )
  });

  try {
    await schema.validate(contactData);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await CheckIsValidContact(contactData.number, companyId);
  const validNumber = await CheckContactNumber(contactData.number, companyId);
  const number = validNumber.jid.replace(/\D/g, "");
  contactData.number = number;

  const { contactId } = req.params;

  const contact = await UpdateContactService({
    contactData,
    contactId,
    companyId
  });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
    action: "update",
    contact
  });

  return res.status(200).json(contact);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId, profile } = req.user; 

  if(profile?.toLocaleLowerCase() === 'user'){
    return res.status(400).json({ message: "Você não tem permissão para executar essa ação!" });

  }

  await ShowContactService(contactId, companyId);

  await DeleteContactService(contactId);

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
    action: "delete",
    contactId
  });

  return res.status(200).json({ message: "Contact deleted" });
};

export const list = async (req: Request, res: Response): Promise<Response> => {
  const { name } = req.query as unknown as SearchContactParams;
  const { companyId } = req.user;

  const contacts = await SimpleListService({ name, companyId });

  return res.json(contacts);
};

export const importContacts = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  if (!req.file) {
    throw new AppError("No file uploaded.");
  }

  const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheetData: RowData[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

  const schema = Yup.object().shape({
    name: Yup.string().required(),
    number: Yup.string().required(),
    email: Yup.string().email().notRequired(),
  });

  const createdContacts = [];
  const errors = [];

  for (const row of sheetData) {
    try {
      console.log("[IMPORT CONTACT BY XLSX]", row)
      const { Nome: name, Telefone: rawNumber, Email: email, ...extraFields } = row;

      if (!name || !rawNumber) {
        throw new Error("Missing required fields: Nome or Telefone.");
      }

      console.log("[IMPORT CONTACT BY XLSX (rawNumber)]", rawNumber, typeof rawNumber)


      const cleanedNumber = rawNumber?.toString().replace(/\D/g, "");

      const contactData = { 
        name, 
        number: cleanedNumber, 
        email 
      };

      if (!/^\d+$/.test(cleanedNumber)) {
        throw new Error(`Invalid phone number after cleaning: ${rawNumber}`);
      }

      await schema.validate(contactData);

      const extraInfo: any = Object.entries(extraFields).map(([key, value]) => ({
        name: key,
        value: String(value),
      }));

      const contact = await CreateContactService({
        ...contactData,
        extraInfo,
        companyId,
      });

      createdContacts.push(contact);
    } catch (err: any) {
      errors.push({ row, error: err.message });
    }
  }

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contacts`, {
    action: "bulk_create",
    contacts: createdContacts,
  });

  console.log("[IMPORT CONTACT BY XLSX]", errors)

  if (errors.length) {
    return res.status(400).json({
      message: "Import completed with errors",
      created: createdContacts.length,
      errors,
    });
  }

  return res.status(200).json({
    message: "Import completed",
    created: createdContacts.length,
    errors,
  });
};
