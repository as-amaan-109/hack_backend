const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

if (!process.env.MONGO_URL) {
  throw new Error("MONGO_URL is not defined in .env");
}

mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ Connected to MongoDB"))
.catch(err => console.error("❌ MongoDB connection error:", err));

app.use(cors({
  origin: 'http://localhost:5173'
}));
app.use(express.json());
app.use('/uploads', express.static('uploads')); // serve images

// ---------------- Multer Setup ----------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 10 MB max
});

// ---------------- Mongoose Schema ----------------
const eventSchema = new mongoose.Schema({
  schedule: String,
  venue: String,
  title: String,
  type: String,
  fee: String,
  description: String,
  // new fields
  wacommunity: String,
  registerlink: String,
  paymentname: String,
  prize: String,
  duration: String,

  teamSize: Number,
  imagePath: String,
  imageMimeType: String
});
  // wacommunity: '',
        // registerlink: '',
        // paymentname:'',
        // prize:'',

const Event = mongoose.model('Event', eventSchema);

// ---------------- Routes ----------------

// POST: Add new event with image
app.post('/api/events', upload.single('image'), async (req, res) => {
  try {
    const { schedule, venue, title, type, fee, description,wacommunity,duration,prize,registerlink,paymentname, teamSize } = req.body;

    const newEvent = new Event({
      schedule,
      venue,
      title,
      type,
      fee,
      description,
      wacommunity,
      registerlink,
      paymentname,
      prize,
      duration,
      teamSize,
      imagePath:  req.file.path.replace(/\\/g, '/'),
      imageMimeType: req.file.mimetype
    });

    await newEvent.save();
    res.status(201).json(newEvent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error saving event', error });
  }
});

// GET: Fetch all events
app.get('/api/events', async (req, res) => {
  try {
    const events = await Event.find();
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching events', error });
  }
});

// DELETE: Remove event
app.delete('/api/events/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid ID' });
    }

    const event = await Event.findByIdAndDelete(id);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.imagePath && fs.existsSync(event.imagePath)) {
      fs.unlinkSync(event.imagePath); // remove image file
    }

    res.status(200).json({ message: 'Event deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting event', error });
  }
});



//  New Steup of Admin


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
    default: 'moderator'
  },
  password: {
    type: String,
    required: true
  }
});

const Admin = mongoose.model('Admin', adminSchema);



app.post('/api/admins', async (req, res) => {
  try {
    const { name, username, type, password } = req.body;

    // Check if username already exists
    const exists = await Admin.findOne({ username });
    if (exists) {
      return res.status(400).json({ message: "Username already exists" });
    }

    const admin = new Admin({ name, username, type, password });
    await admin.save();
    res.status(201).json({ message: "Admin created successfully", admin });
  } catch (error) {
    res.status(500).json({ message: "Error creating admin", error });
  }
});

// Get all admins
app.get('/api/admins', async (req, res) => {
  try {
    const admins = await Admin.find();
    res.status(200).json(admins);
  } catch (error) {
    res.status(500).json({ message: "Error fetching admins", error });
  }
});


app.post('/api/admins/edit/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, username, type, password } = req.body;

    // Check if username already exists and is not this admin
    const exists = await Admin.findOne({ username });
    if (exists && exists._id.toString() !== id) {
      return res.status(400).json({ message: "Username already exists" });
    }

    // Find admin by ID
    const admin = await Admin.findById(id);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Update admin fields
    admin.name = name;
    admin.username = username;
    admin.type = type;
    admin.password = password;

    await admin.save();

    res.status(200).json({ message: "Admin updated successfully", admin });

  } catch (error) {
    console.error('Error editing admin:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});


app.delete('/api/admins/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deletedAdmin = await Admin.findByIdAndDelete(id);

    if (!deletedAdmin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.status(200).json({ message: "Admin deleted successfully" });
  } catch (error) {
    console.error('Error deleting admin:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    console.log('Login attempt:', { username, password });
    try {
        // Look for admin by username
        const admin = await Admin.findOne({ username });

        if (admin) {
            if (password === admin.password) {
                // Send success response if password matches
                return res.json({ success: true });
            } else {
                // Send error if password is incorrect
                return res.status(401).json({ success: false, message: 'Incorrect password' });
            }
        } else {
            // Send error if admin with that username doesn't exist
            return res.status(404).json({ success: false, message: 'Admin not found' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});














// COntact us


const contactSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Contact = mongoose.model('Contact', contactSchema);

app.post('/api/contact', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, message } = req.body;

    if (!firstName || !lastName || !email || !message) {
      return res.status(400).json({ message: 'All required fields must be filled.' });
    }

    const contact = new Contact({ firstName, lastName, email, phone, message});
    await contact.save();

    res.status(200).json({ message: 'Message sent successfully!' });
  } catch (err) {
    console.error('Contact form submission failed:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/contact', async (req, res) => {
  try {
    const contacts = await Contact.find();
    res.status(200).json(contacts);
  } catch (err) {
    console.error('Error fetching contacts:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/contact/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deletedContact = await Contact.findByIdAndDelete(id);

    if (!deletedContact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    res.status(200).json({ message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/contact/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phone, message } = req.body;

    const contact = await Contact.findById(id);
    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }
    contact.firstName = firstName;
    contact.lastName = lastName;
    contact.email = email;
    contact.phone = phone;
    contact.message = message;
    await contact.save();
    res.status(200).json({ message: 'Contact updated successfully', contact });
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ message: 'Server error' });
  }
});





// System Data Schema
const milestoneSchema = new mongoose.Schema({
  title: { type: String, required: true },
  value: { type: String, required: true }, // e.g., "8,98,884+", "100+"
});

const systemDataSchema = new mongoose.Schema({
  socialMediaLinks: {
    instagram: { type: String },
    x: { type: String }, // Twitter (X)
    facebook: { type: String },
    github: { type: String },
  },
  milestones: [milestoneSchema],
  logo: {
    name: { type: String, required: true },
    imagePath: { type: String, required: true },
  },
  officeDetails: {
    address: { type: String, required: true },
    contactNumber: { type: String, required: true },
    email: { type: String, required: true },
  },
  promoVideoPath: { type: String }
}, { timestamps: true });

const SystemData = mongoose.model('SystemData', systemDataSchema);



// Create or Update System Data
// Multiple file fields setup
const cpUpload = upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]);


app.post('/system-data', cpUpload, async (req, res) => {
  try {
    const data = req.body;

    const newSystemData = {
      socialMediaLinks: JSON.parse(data.socialMediaLinks),
      milestones: JSON.parse(data.milestones),
      officeDetails: JSON.parse(data.officeDetails),
      logo: {
        name: data.logoName,
        imagePath: req.files?.logo?.[0]?.path || '',
      },
      promoVideoPath: req.files?.video?.[0]?.path || '',
    };

    let existing = await SystemData.findOne();
    if (existing) {
      await SystemData.updateOne({}, newSystemData);
      res.status(200).json({ message: 'System data updated' });
    } else {
      const newEntry = new SystemData(newSystemData);
      await newEntry.save();
      res.status(201).json({ message: 'System data created' });
    }
  } catch (err) {
    console.error('Error saving system data:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get System Data
app.get('/system-data', async (req, res) => {
  try {
    const data = await SystemData.findOne();
    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching system data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});





// Team Members 

const memberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subtitle: { type: String, required: true },
  imagePath: { type: String, required: true }
});

const designationSchema = new mongoose.Schema({
  title: { type: String, required: true }, // e.g., Founder, Co-Founder
  members: [memberSchema]
});

const Team = mongoose.model('Team', designationSchema);

app.post('/api/team', upload.any(), async (req, res) => {
  try {
    const { title } = req.body;
    const members = JSON.parse(req.body.members); // members is sent as JSON string

    // Match each uploaded file to its member using fieldname convention like "image0"
    const finalMembers = members.map((member, index) => {
      const imageFile = req.files.find(file => file.fieldname === `image${index}`);
      return {
        name: member.name,
        subtitle: member.subtitle,
        imagePath: imageFile ? `/uploads/${imageFile.filename}` : ''
      };
    });

    const newTeam = new Team({ title, members: finalMembers });
    await newTeam.save();
    res.status(201).json(newTeam);

  } catch (err) {
    res.status(400).json({ message: 'Invalid data', error: err.message });
  }
});


app.get('/api/team', async (req, res) => {
  try {
    const data = await Team.find();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/team/:id', upload.any(), async (req, res) => {
  try {
    const { title } = req.body;
    const members = JSON.parse(req.body.members);

    const updatedMembers = members.map((member, index) => {
      const imageFile = req.files.find(file => file.fieldname === `image${index}`);
      return {
        name: member.name,
        subtitle: member.subtitle,
        imagePath: imageFile ? `/uploads/${imageFile.filename}` : member.imagePath || ''
      };
    });

    const updatedTeam = await Team.findByIdAndUpdate(req.params.id, {
      title,
      members: updatedMembers
    }, { new: true });

    res.json(updatedTeam);
  } catch (err) {
    res.status(400).json({ message: 'Update failed', error: err.message });
  }
});

app.delete('/api/team/:id', async (req, res) => {
  try {
    await Team.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Delete failed', error: err.message });
  }
});



















// Test route
app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
