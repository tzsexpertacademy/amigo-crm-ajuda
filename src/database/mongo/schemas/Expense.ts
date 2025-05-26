import mongoose, { Schema, Document } from 'mongoose';
import { ICategory } from './Category';
import { IUser } from './User';
import { ICreditCard } from './CreditCard';

export interface IExpense extends Document {
  title: string;
  description?: string;
  paymentMethod?: string;
  value: number;
  contactId: string;
  phoneNumber: string;
  user?: IUser | mongoose.Types.ObjectId; // Relacionamento com usuário
  category?: ICategory | mongoose.Types.ObjectId; // Relacionamento com categoria (opcional)
  creditCard?: ICreditCard | mongoose.Types.ObjectId; // Relacionamento com cartão de crédito (opcional)
  registeredAt?: Date; // Data de registro do gasto
  createdAt?: Date;
  updatedAt?: Date;
}

const ExpenseSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    value: { type: Number, required: true },
    paymentMethod: { type: String, required: false },
    contactId: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Relacionamento com User
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' }, // Relação com Category
    creditCard: { type: mongoose.Schema.Types.ObjectId, ref: 'CreditCard', required: false }, // Relação opcional com Cartão
    registeredAt: { type: Date, default: Date.now }, // Data de registro (padrão: agora)
  },
  { timestamps: true }
);

export const Expense = mongoose.model<IExpense>('Expense', ExpenseSchema);
