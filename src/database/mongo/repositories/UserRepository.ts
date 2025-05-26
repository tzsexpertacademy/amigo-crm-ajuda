import { User, IUser } from '../schemas/User';

class UserRepository {
  // Criar um novo usuário
  async createUser(data: Partial<IUser>): Promise<IUser> {
    const user = new User(data);
    return await user.save();
  }

  // Buscar um usuário pelo phoneNumber
  async findUserByPhoneNumber(phoneNumber: string): Promise<IUser | null> {
    return await User.findOne({ phoneNumber });
  }

  // Buscar por qualquer critério
  async findOne(criteria: any): Promise<IUser | null> {
    return await User.findOne(criteria);
  }

  // Atualizar um usuário pelo phoneNumber
  async updateUserByPhoneNumber(
    phoneNumber: string,
    data: Partial<IUser>
  ): Promise<IUser | null> {
    return await User.findOneAndUpdate({ phoneNumber }, data, { new: true });
  }

  // Deletar um usuário pelo phoneNumber
  async deleteUserByPhoneNumber(phoneNumber: string): Promise<IUser | null> {
    return await User.findOneAndDelete({ phoneNumber });
  }

  // Listar todos os usuários (opcionalmente filtrar por status)
  async findAllUsers(status?: string): Promise<IUser[]> {
    const query: any = {};
    if (status) {
      query.status = status;
    }
    return await User.find(query);
  }
}

export const userRepository = new UserRepository();
