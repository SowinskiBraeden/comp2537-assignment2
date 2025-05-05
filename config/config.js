require('dotenv').config();

module.exports = {
  mongo_user:     process.env.MONGODB_USER,
  mongo_password: process.env.MONGODB_PASSWORD,
  mongo_host:     process.env.MONGODB_HOST,
  mongo_database: process.env.MONGODB_DATABASE,
  mongo_secret:   process.env.MONGODB_SESSION_SECRET,
  express_secret: process.env.NODE_SESSION_SECRET,
};
