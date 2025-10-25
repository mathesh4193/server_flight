let ioInstance = null;

module.exports = {
  init: (server) => {
    const { Server } = require('socket.io');
    const io = new Server(server, {
      cors: { origin: process.env.FRONTEND_URL || '*' },
    });
    io.on('connection', (socket) => {
      // client should join user room after login
      socket.on('join', (userId) => {
        if (userId) socket.join(userId);
      });
      socket.on('leave', (userId) => {
        if (userId) socket.leave(userId);
      });
    });
    ioInstance = io;
    return io;
  },
  getIO: () => ioInstance,
};
