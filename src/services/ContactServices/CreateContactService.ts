import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";

interface ExtraInfo extends ContactCustomField {
  name: string;
  value: string;
}

interface Request {
  name: string;
  number: string;
  email?: string;
  profilePicUrl?: string;
  companyId: number;
  extraInfo?: ExtraInfo[];
}

const CreateContactService = async ({
  name,
  number,
  email = "",
  companyId,
  extraInfo = [],
}: Request): Promise<Contact> => {
  const numberExists = await Contact.findOne({
    where: { number, companyId },
  });

  if (numberExists) {
    throw new AppError("ERR_DUPLICATED_CONTACT");
  }

  const contact = await Contact.create(
    {
      name,
      number,
      email,
      companyId,
    }
  );

  if (extraInfo.length > 0) {
    await Promise.all(
      extraInfo.map(async (info) =>
        contact.$create("extraInfo", {
          ...info,
          contactId: contact.id, // Relaciona com o ID do contato criado
        })
      )
    );
  }

  return contact;
};


export default CreateContactService;
