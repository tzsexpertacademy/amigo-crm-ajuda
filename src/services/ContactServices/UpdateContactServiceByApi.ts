import AppError from "../../errors/AppError";
import { createCache } from "../../middleware/cacheMid";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import { getIO } from "../../libs/socket";

interface ExtraInfo {
  id?: number;
  name: string;
  value: string;
}
interface ContactData {
  email?: string;
  number?: string;
  name?: string;
  extraInfo?: ExtraInfo[];
}

interface Request {
  contactData: ContactData;
  companyId: number;
}

const UpdateContactServiceByApi = async ({
  contactData,
  companyId
}: Request, res: any): Promise<ContactData> => {
  const { number, extraInfo, name, email } = contactData;

  try {
    const foundContact = await Contact.findOne({
      where: { number, companyId },
      attributes: [
        "id",
        "name",
        "number",
        "email",
        "companyId",
        "profilePicUrl"
      ],
      include: ["extraInfo"]
    });

    if (!foundContact) {
      console.log("[UPDATE CUSTOMER] - Contact not found");
      return res.status(404).json({ error: "Contact not found" });
    }

    if (foundContact.companyId !== companyId) {
      console.log("[UPDATE CUSTOMER] - Company mismatch");
      return res.status(400).json({ error: "Company mismatch" });
    }

    if (extraInfo && !Array.isArray(extraInfo)) {
      console.error("[UPDATE CUSTOMER] - Invalid extraInfo format");
      return res.status(400).json({ error: "Invalid extraInfo format" });
    }

    // Atualiza os campos principais do contato
    if (name && name.trim() !== "") {
      foundContact.name = name;
    }
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      foundContact.email = email;
    }

    // Salva o contato atualizado
    await foundContact.save();

    // Atualiza ou insere campos personalizados
    if (extraInfo && extraInfo.length > 0) {
      await Promise.all(
        extraInfo.map(async (info) => {
          if (info.name && info.value) {
            await ContactCustomField.upsert({
              name: info.name,
              value: info.value,
              contactId: foundContact.id
            });
          }
        })
      );
    }

    // Busca o contato atualizado com os campos personalizados
    const updatedContact = await Contact.findOne({
      where: { id: foundContact.id },
      include: ["extraInfo"]
    });

    console.log("[UPDATE CUSTOMER] - Contact updated successfully:", updatedContact?.number);

    // Dispara o evento no WebSocket com os dados atualizados
    const io = getIO();
    io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
      action: "update",
      contact: updatedContact
    });

    return res.status(200).json({ message: "Contact updated successfully", contact: updatedContact });

  } catch (error) {
    console.error("[UPDATE CUSTOMER] - Error:", error);
    return res.status(500).json({ error: "Erro ao atualizar contato" });
  }
};

export default UpdateContactServiceByApi;
