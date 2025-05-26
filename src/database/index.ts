import { Sequelize } from "sequelize-typescript";
import User from "../models/User";
import Setting from "../models/Setting";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";
import ContactCustomField from "../models/ContactCustomField";
import Message from "../models/Message";
import Queue from "../models/Queue";
import WhatsappQueue from "../models/WhatsappQueue";
import UserQueue from "../models/UserQueue";
import Company from "../models/Company";
import Plan from "../models/Plan";
import TicketNote from "../models/TicketNote";
import QuickMessage from "../models/QuickMessage";
import Help from "../models/Help";
import TicketTraking from "../models/TicketTraking";
import UserRating from "../models/UserRating";
import QueueOption from "../models/QueueOption";
import Schedule from "../models/Schedule";
import Tag from "../models/Tag";
import TicketTag from "../models/TicketTag";
import ContactList from "../models/ContactList";
import ContactListItem from "../models/ContactListItem";
import Campaign from "../models/Campaign";
import CampaignSetting from "../models/CampaignSetting";
import Baileys from "../models/Baileys";
import CampaignShipping from "../models/CampaignShipping";
import Announcement from "../models/Announcement";
import Chat from "../models/Chat";
import ChatUser from "../models/ChatUser";
import ChatMessage from "../models/ChatMessage";
import Invoices from "../models/Invoices";
import Subscriptions from "../models/Subscriptions";
import BaileysChats from "../models/BaileysChats";
import Files from "../models/Files";
import FilesOptions from "../models/FilesOptions";
import Prompt from "../models/Prompt";
import QueueIntegrations from "../models/QueueIntegrations";
import Appointment from "../models/Appointment";
import Services from "../models/Service";
import UserServices from "../models/UserServices";
const { exec } = require("child_process");
require("../bootstrap")
// eslint-disable-next-line
const dbConfig = require("../config/database");
// import dbConfig from "../config/database";

const sequelize = new Sequelize(dbConfig);

const models = [
  Company,
  User,
  Prompt,
  Contact,
  QueueOption,
  Ticket,
  Message,
  Whatsapp,
  ContactCustomField,
  Setting,
  Queue,
  WhatsappQueue,
  UserQueue,
  Plan,
  TicketNote,
  QuickMessage,
  Help,
  TicketTraking,
  UserRating,
  Schedule,
  Tag,
  TicketTag,
  ContactList,
  ContactListItem,
  Campaign,
  CampaignSetting,
  Baileys,
  CampaignShipping,
  Announcement,
  Chat,
  ChatUser,
  ChatMessage,
  Invoices,
  Subscriptions,
  BaileysChats,
  Files,
  FilesOptions,
  QueueIntegrations,
  Appointment,
  Services,
  UserServices
];

sequelize.addModels(models);

const syncModelsIndividually = async () => {


  const models2 = [User];

  for (const model of models2) {
    try {
      await model.sync({ alter: true });
      console.log(`✅ Modelo ${model.name} sincronizado com sucesso.`);
    } catch (error) {
      console.warn(
        `⚠️  Erro ao sincronizar o modelo ${model.name}:`,
        error.message
      );
    }
  }
};


if (true) {
   syncModelsIndividually()
     .then(() => {
       console.log("✅ Sincronização concluída.");
     })
    .catch(error => {
     console.error("❌ Erro na sincronização:", error);
  });

} else {
  console.log("⚠️  Sincronização desativada. Defina DB_SYNC=true para ativar.");
}

const restartApplication = () => {
  console.log("Conexão com o banco perdida. Reiniciando a aplicação...");
  exec("pm2 restart 39", (error, stdout, stderr) => {
    if (error) {
      console.error(`Erro ao reiniciar a aplicação via PM2: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Erro do PM2: ${stderr}`);
      return;
    }
    console.log(`Aplicação reiniciada via PM2: ${stdout}`);
  });
  exec("sudo systemctl restart postgresql", (error, stdout, stderr) => {
    if (error) {
      console.error(`Erro ao reiniciar o postgresql: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Erro do PM2: ${stderr}`);
      return;
    }
    console.log(`Postgresql reiniciado: ${stdout}`);
  });
};

const monitorDatabaseConnection = async () => {
  try {
    await sequelize.authenticate();
    // console.log("Conexão com o banco de dados estável.");
  } catch (error) {
    console.error("Erro na conexão com o banco:", error.message);
//    restartApplication();
  }
};

// setInterval(monitorDatabaseConnection, 30000);

export default sequelize;
