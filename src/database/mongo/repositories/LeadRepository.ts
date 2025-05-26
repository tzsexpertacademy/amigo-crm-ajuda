import { ILead, Lead } from "../schemas/Lead";

class LeadRepository {
    async upsertLoginAttempts(phoneNumber: string, loginAttempts?: number): Promise<ILead> {
      return Lead.findOneAndUpdate(
        { phoneNumber },
        { $inc: { loginAttempts: loginAttempts ?? 1 } },
        { new: true, upsert: true }
      );
    }
  }
  
  export const leadRepository = new LeadRepository();
  