import { send_spreadsheet } from "../services/WbotServices/OpenaiFunctions";

async function test() {
  await send_spreadsheet({}, { phoneNumber: '559891491331' })
}

test()
