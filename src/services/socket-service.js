let io = null;
const roomSockets = new Map(); // Map<tranid, Set<socketId>>

function initSocket(server) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: { origin: "*" },
    path: "/socket.io/"  // quan trọng, khớp client
  });

  io.on('connection', (socket) => {
    console.log('🟢 Socket connected:', socket.id);

    socket.on('join_payment_room', (tranid) => {
      if (tranid) {
        socket.join(tranid);
        console.log(`✅ Socket ${socket.id} joined room: ${tranid}`);

        // Ghi nhận socket tham gia room
        if (!roomSockets.has(tranid)) {
          roomSockets.set(tranid, new Set());
        }
        roomSockets.get(tranid).add(socket.id);
      }
    });

    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected:', socket.id);

      // Xóa socket khỏi mọi room mà nó tham gia
      for (const [tranid, socketsSet] of roomSockets.entries()) {
        socketsSet.delete(socket.id);
        if (socketsSet.size === 0) {
          roomSockets.delete(tranid);
        }
      }
    });
  });
}

// Emit và kiểm tra có ai trong room không
function emitToRoom(tranid, event, data) {
  if (!io) return;

  const socketsSet = roomSockets.get(tranid);
  if (!socketsSet || socketsSet.size === 0) {
    console.warn(`⚠️ Không còn socket nào trong room ${tranid}`);
    return false; // emit không thực hiện
  }

  io.to(tranid).emit(event, data);
  return true; // emit thành công
}

module.exports = {
  initSocket,
  emitToRoom
};