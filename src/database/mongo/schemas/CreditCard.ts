import mongoose, { Schema, Document } from 'mongoose';
import { IUser } from './User';

export interface ICreditCard extends Document {
  user: IUser | mongoose.Types.ObjectId; // Relacionamento com o usuário
  cardName: string; // Nome do cartão
  dueDate: string; // Dia de vencimento da fatura
  closingDate: string; // Dia de fechamento da fatura
  createdAt?: Date;
  updatedAt?: Date;
}

const CreditCardSchema: Schema = new Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cardName: { type: String, required: true },
    dueDate: { type: String, required: true, min: 1, max: 31 },
    closingDate: { type: String, required: true, min: 1, max: 31 },
  },
  { timestamps: true } // Gera createdAt e updatedAt automaticamente
);

export const CreditCard = mongoose.model<ICreditCard>('CreditCard', CreditCardSchema);
