import mongoose, { Schema, Document } from 'mongoose';
import { IUser } from './User';
import { ICreditCard } from './CreditCard';
import { ICategory } from './Category';

export interface IIncome extends Document {
  title: string;
  description?: string;
  paymentMethod?: string;
  value: number;
  contactId: string;
  phoneNumber: string;
  user?: IUser | mongoose.Types.ObjectId; // Relacionamento com usuário
  creditCard?: ICreditCard | mongoose.Types.ObjectId; // Relacionamento opcional com cartão de crédito
  category?: ICategory | mongoose.Types.ObjectId; // Relacionamento opcional com categoria
  registeredAt?: Date; // Data de registro do ganho
  createdAt?: Date;
  updatedAt?: Date;
}

const IncomeSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    value: { type: Number, required: true },
    paymentMethod: { type: String, required: false },
    contactId: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Relacionamento com User
    creditCard: { type: mongoose.Schema.Types.ObjectId, ref: 'CreditCard', required: false }, // Relação opcional com Cartão
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: false }, // Relação opcional com Categoria
    registeredAt: { type: Date, default: Date.now }, // Data de registro (padrão: agora)
  },
  { timestamps: true }
);

export const Income = mongoose.model<IIncome>('Income', IncomeSchema);
