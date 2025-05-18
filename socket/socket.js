let io = null;

function initSocket(server) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: { origin: "*" }
  });

  io.on('connection', (socket) => {
    console.log('🟢 Socket connected:', socket.id);

    socket.on('join_payment_room', (tranid) => {
      if (tranid) {
        socket.join(tranid);
        console.log(`✅ Socket ${socket.id} joined room: ${tranid}`);
      }
    });

    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected:', socket.id);
    });
  });
}

function emitToRoom(tranid, event, data) {
  if (!io) return;
  io.to(tranid).emit(event, data);
}

module.exports = {
  initSocket,
  emitToRoom
};