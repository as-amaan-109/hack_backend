
const adminSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true,
    unique: true // usernames must be unique
  },
  type: {
    type: String,
    enum: ['superadmin', 'moderator', 'viewer'], // customize as needed
    default: 'moderator'
  },
  password: {
    type: String,
    required: true
  }
});

module.exports = mongoose.model('Admin', adminSchema);

