import { createClient } from "redis";
import { REDIS_URI_CONNECTION } from "../config/redis";


const redisClient = createClient({
  url: REDIS_URI_CONNECTION
});

redisClient.connect()
  .then(async () => {
    console.log("✅ Conectado ao Redis!");

    // 🔥 Teste de escrita e leitura
    try {
      await redisClient.set("teste_key", "Funcionando!");
      const value = await redisClient.get("teste_key");
      console.log("✅ Teste Redis - Valor armazenado:", value);
    } catch (err) {
      console.error("❌ Erro ao testar escrita no Redis:", err);
    }
  })
  .catch((err) => {
    console.error("❌ Erro ao conectar ao Redis:", REDIS_URI_CONNECTION, err);
  });

redisClient.on("error", (err) => {
  console.error("Redis error: ",REDIS_URI_CONNECTION, err);
});

export { redisClient };

