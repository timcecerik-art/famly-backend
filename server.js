const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://timcecerik_db_user:Timcecerik1906@famly.r2auhfs.mongodb.net/famly?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(() => console.log("Mit MongoDB verbunden!"))
  .catch(err => console.error("MongoDB Fehler:", err));

// ---------------------------------------------------------------------------
// SCHEMAS & MODELS
// ---------------------------------------------------------------------------

const Task = mongoose.model('Task', new mongoose.Schema({
  title: String,
  assignedToMemberId: String,
  createdByMemberId: String,
  isDone: { type: Boolean, default: false },
  dueDate: Date,
  timeSlot: String,
  recurring: String,
  estimatedMinutes: { type: Number, default: 15 },
  xpApproved: { type: Boolean, default: false },
  approvedBy: String
}), 'tasks');

const UserXp = mongoose.model('UserXp', new mongoose.Schema({
  memberId: { type: String, unique: true },
  xp: { type: Number, default: 0 }
}), 'user_xps');

// Belohnungen / Shop-Artikel
const RewardRequest = mongoose.model('RewardRequest', new mongoose.Schema({
  memberId: String,
  memberName: String,
  title: String,
  xpCost: Number,
  status: { type: String, default: 'pending' }, // 'pending', 'approved', 'rejected'
  createdAt: { type: Date, default: Date.now }
}), 'reward_requests');

const Event = mongoose.model('Event', new mongoose.Schema({ title: String, date: Date, createdByMemberId: String }), 'events');
const ChatMessage = mongoose.model('ChatMessage', new mongoose.Schema({ senderName: String, text: String, timestamp: { type: Date, default: Date.now } }), 'chat_messages');
const Finance = mongoose.model('Finance', new mongoose.Schema({ title: String, amount: Number, isExpense: Boolean }), 'finances');
const ShoppingItem = mongoose.model('ShoppingItem', new mongoose.Schema({ title: String, isBought: { type: Boolean, default: false } }), 'shopping_items');
const Lesson = mongoose.model('Lesson', new mongoose.Schema({ memberId: String, day: String, time: String, subject: String, room: String, isCanceled: { type: Boolean, default: false } }), 'schedule_lessons');
const Document = mongoose.model('Document', new mongoose.Schema({ name: String }), 'documents');
const MealPlan = mongoose.model('MealPlan', new mongoose.Schema({ day: { type: String, unique: true }, meal: String }), 'meal_plans');
const Location = mongoose.model('Location', new mongoose.Schema({ memberName: { type: String, unique: true }, location: String }), 'locations');

// ---------------------------------------------------------------------------
// ENDPUNKTE (API)
// ---------------------------------------------------------------------------

// --- TASKS & XP ---
app.get('/api/tasks', async (req, res) => res.json(await Task.find()));
app.post('/api/tasks', async (req, res) => res.json(await new Task(req.body).save()));
app.put('/api/tasks/:id', async (req, res) => res.json(await Task.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.delete('/api/tasks/:id', async (req, res) => { await Task.findByIdAndDelete(req.params.id); res.json({ success: true }); });

app.put('/api/tasks/:id/approve-xp', async (req, res) => {
  const { approverId } = req.body;
  if (approverId !== '1' && approverId !== '2') return res.status(403).json({ error: 'Nur Mama/Vincent' });

  const task = await Task.findById(req.params.id);
  if (!task || task.xpApproved) return res.json(task);

  task.xpApproved = true;
  task.approvedBy = approverId;
  await task.save();

  await UserXp.findOneAndUpdate(
    { memberId: task.assignedToMemberId },
    { $inc: { xp: task.estimatedMinutes } },
    { upsert: true, new: true }
  );
  res.json(task);
});

app.get('/api/xp', async (req, res) => res.json(await UserXp.find()));

// --- SHOP & REWARDS ---
app.get('/api/rewards/requests', async (req, res) => res.json(await RewardRequest.find().sort({ createdAt: -1 })));

app.post('/api/rewards/request', async (req, res) => {
  const { memberId, memberName, title, xpCost } = req.body;
  const userXp = await UserXp.findOne({ memberId });
  
  if (!userXp || userXp.xp < xpCost) {
    return res.status(400).json({ error: 'Nicht genügend XP vorhanden!' });
  }

  const newReq = new RewardRequest({ memberId, memberName, title, xpCost });
  res.json(await newReq.save());
});

// Mama/Vincent bestätigen die Einlösung -> XP abziehen
app.put('/api/rewards/approve/:id', async (req, res) => {
  const { approverId } = req.body;
  if (approverId !== '1') {
    return res.status(403).json({ error: 'Nur Mama kann Belohnungen freigeben!' });
  }

  const reqItem = await RewardRequest.findById(req.params.id);
  if (!reqItem || reqItem.status !== 'pending') return res.json(reqItem);

  reqItem.status = 'approved';
  await reqItem.save();

  // XP vom Punktekonto abziehen
  await UserXp.findOneAndUpdate(
    { memberId: reqItem.memberId },
    { $inc: { xp: -reqItem.xpCost } }
  );

  res.json(reqItem);
});

// --- RESTLICHE API ENDPUNKTE ---
app.get('/api/events', async (req, res) => res.json(await Event.find()));
app.post('/api/events', async (req, res) => res.json(await new Event(req.body).save()));
app.delete('/api/events/:id', async (req, res) => { await Event.findByIdAndDelete(req.params.id); res.json({ success: true }); });
app.get('/api/messages', async (req, res) => res.json(await ChatMessage.find().sort({ timestamp: 1 })));
app.post('/api/messages', async (req, res) => res.json(await new ChatMessage(req.body).save()));
app.get('/api/finances', async (req, res) => res.json(await Finance.find()));
app.post('/api/finances', async (req, res) => res.json(await new Finance(req.body).save()));
app.get('/api/shopping', async (req, res) => res.json(await ShoppingItem.find()));
app.post('/api/shopping', async (req, res) => res.json(await new ShoppingItem(req.body).save()));
app.put('/api/shopping/:id', async (req, res) => res.json(await ShoppingItem.findByIdAndUpdate(req.params.id, { isBought: req.body.isBought }, { new: true })));
app.get('/api/lessons', async (req, res) => res.json(await Lesson.find()));
app.post('/api/lessons', async (req, res) => res.json(await new Lesson(req.body).save()));
app.put('/api/lessons/:id', async (req, res) => res.json(await Lesson.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.get('/api/documents', async (req, res) => res.json(await Document.find()));
app.post('/api/documents', async (req, res) => res.json(await new Document(req.body).save()));
app.delete('/api/documents/:id', async (req, res) => { await Document.findByIdAndDelete(req.params.id); res.json({ success: true }); });
app.get('/api/meals', async (req, res) => res.json(await MealPlan.find()));
app.put('/api/meals', async (req, res) => res.json(await MealPlan.findOneAndUpdate({ day: req.body.day }, { meal: req.body.meal }, { upsert: true, new: true })));
app.get('/api/locations', async (req, res) => res.json(await Location.find()));
app.put('/api/locations', async (req, res) => res.json(await Location.findOneAndUpdate({ memberName: req.body.memberName }, { location: req.body.location }, { upsert: true, new: true })));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));