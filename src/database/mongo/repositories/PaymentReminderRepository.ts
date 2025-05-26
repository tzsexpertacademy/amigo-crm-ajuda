import { IPaymentReminder, PaymentReminder } from "../schemas/PaymentReminder";

class PaymentReminderRepository {
    // Criar um novo lembrete de pagamento
    async createReminder(data: Partial<IPaymentReminder>): Promise<IPaymentReminder> {
      const reminder = new PaymentReminder(data);
      return await reminder.save();
    }
  
    // Buscar lembretes por usuário e período
    async findRemindersByDate(userId: string, startDate: Date, endDate: Date): Promise<IPaymentReminder[]> {
      return await PaymentReminder.find({
        user: userId,
        date: { $gte: startDate, $lte: endDate },
      }).sort({ date: 1 });
    }
  
    // Atualizar um lembrete pelo título e usuário
    async updateReminderByTitle(userId: string, title: string, data: Partial<IPaymentReminder>): Promise<IPaymentReminder | null> {
      return await PaymentReminder.findOneAndUpdate(
        { user: userId, title },
        data,
        { new: true }
      );
    }
  
    // Deletar um lembrete pelo título e usuário
    async deleteReminderByTitle(userId: string, title: string): Promise<IPaymentReminder | null> {
      return await PaymentReminder.findOneAndDelete({ user: userId, title });
    }
  }
  
  export const paymentReminderRepository = new PaymentReminderRepository();
  