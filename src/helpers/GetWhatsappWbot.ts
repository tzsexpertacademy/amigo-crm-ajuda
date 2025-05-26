import { getWbot, getWbotV2 } from "../libs/wbot";
import Whatsapp from "../models/Whatsapp";

const GetWhatsappWbot = async (whatsapp: Whatsapp, mode: string = "v1") => {
  // console.log("[GetWhatsappWbot]", whatsapp);
  let wbot = null;
  if (mode === "v1") {
    wbot = await getWbot(whatsapp.id);
  }
  if (mode === "v2") {
    wbot = await getWbotV2(whatsapp.id, true);
  }
  return wbot;
};

export default GetWhatsappWbot;
