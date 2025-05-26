const { io } = require("socket.io-client");

const socket = io("https://api.tzsexpertacademy.com", {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: 20,
  timeout: 10000,
  query: {
    token: "PvRchRvbC3bbcJ!H9^f&iL" // Certifique-se de definir o token no ambiente
  }
});

socket.on("connect", () => {
  console.log("🔗 Conectado ao WebSocket em https://api.tzsexpertacademy.com");
  socket.emit("test:event", { message: "Evento de teste" });
});

socket.on("disconnect", reason => {
  console.log(`❌ Desconectado do WebSocket. Motivo: ${reason}`);
});

socket.on("connect_error", error => {
  console.error("⚠️ Erro de conexão:", error.message);
});

module.exports = socket;
