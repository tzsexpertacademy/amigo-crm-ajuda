import { CreditCard, ICreditCard } from '../schemas/CreditCard';

class CreditCardRepository {
  // Criar um novo cartão
  async createCard(data: Partial<ICreditCard>): Promise<ICreditCard> {
    const card = new CreditCard(data);
    return await card.save();
  }

  // Buscar um cartão pelo ID do usuário
  async findCardByUserId(userId: string): Promise<ICreditCard | null> {
    return await CreditCard.findOne({ user: userId });
  }

  // Buscar todos os cartões de um usuário
  async findAllCardsByUserId(userId: string): Promise<ICreditCard[]> {
    return await CreditCard.find({ user: userId });
  }

   // Deletar um cartão pelo nome e usuário
   async deleteCardByName(userId: string, cardName: string): Promise<ICreditCard | null> {
    return await CreditCard.findOneAndDelete({ user: userId, cardName });
  }

  // Atualizar um cartão pelo nome e usuário
  async updateCardByName(userId: string, cardName: string, data: Partial<ICreditCard>): Promise<ICreditCard | null> {
    return await CreditCard.findOneAndUpdate(
      { user: userId, cardName },
      data,
      { new: true }
    );
  }
}

export const creditCardRepository = new CreditCardRepository();
