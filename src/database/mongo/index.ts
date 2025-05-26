import mongoose from 'mongoose';

 const mongoUri = 'mongodb://root:qkaaqwujebs21@130.185.118.63:27028';
// const mongoUri = process.env.MONGO_URI;

// Função para conectar ao MongoDB
export const connectMongoDB = async (): Promise<void> => {
  try {
    await mongoose.connect(mongoUri); // Opções adicionais não são mais necessárias
    console.log('Conexão com o MongoDB estabelecida.');
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error);
   // process.exit(1);
  }
};

// Função para fechar a conexão com o MongoDB
export const disconnectMongoDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.log('Conexão com o MongoDB encerrada.');
  } catch (error) {
    console.error('Erro ao encerrar a conexão com o MongoDB:', error);
  }
};
