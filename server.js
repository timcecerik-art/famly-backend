const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB Verbindung (Verwendet Environment Variable oder Fallback-URI)
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://timcecerik_db_user:Timcecerik1906%21@famly.r2auhfs.mongodb.net/famly?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(() => console.log("Mit MongoDB verbunden!"))
  .catch(err => console.error("MongoDB Fehler:", err));

// ---------------------------------------------------------------------------
// MONGOOSE SCHEMAS & MODELS
// ---------------------------------------------------------------------------

// 1. Aufgaben (Collection: tasks)
const TaskSchema = new mongoose.Schema({
  title: String,
  assignedToMemberId: String,
  createdByMemberId: String,
  isDone: { type: Boolean, default: false },
  dueDate: Date,
  timeSlot: String,        // 'morning', 'afternoon', 'evening', 'anytime'
  recurring: String,       // 'none', 'daily', 'weekly'
  estimatedMinutes: { type: Number, default: 15 },
  xpApproved: { type: Boolean, default: false },
  approvedBy: String
});
const Task = mongoose.model('Task', TaskSchema, 'tasks');

// 2. XP Konto (Collection: user_xps)
const UserXpSchema = new mongoose.Schema({
  memberId: { type: String, unique: true },
  xp: { type: Number, default: 0 }
});
const UserXp = mongoose.model('UserXp', UserXpSchema, 'user_xps');

// 3. Termine (Collection: events)
const Event = mongoose.model('Event', new mongoose.Schema({
  title: String,
  date: Date,
  createdByMemberId: String
}), 'events');

// 4. Chat (Collection: chat_messages)
const ChatMessage = mongoose.model('ChatMessage', new mongoose.Schema({
  senderName: String,
  text: String,
  timestamp: { type: Date, default: Date.now }
}), 'chat_messages');

// 5. Finanzen (Collection: finances)
const Finance = mongoose.model('Finance', new mongoose.Schema({
  title: String,
  amount: Number,
  isExpense: Boolean
}), 'finances');

// 6. Einkaufsliste (Collection: shopping_items)
const ShoppingItem = mongoose.model('ShoppingItem', new mongoose.Schema({
  title: String,
  isBought: { type: Boolean, default: false }
}), 'shopping_items');

// 7. Stundenplan (Collection: schedule_lessons)
const Lesson = mongoose.model('Lesson', new mongoose.Schema({
  memberId: String,
  day: String,
  time: String,
  subject: String,
  room: String,
  isCanceled: { type: Boolean, default: false }
}), 'schedule_lessons');

// 8. Dokumente (Collection: documents)
const Document = mongoose.model('Document', new mongoose.Schema({
  name: String
}), 'documents');

// 9. Essensplan (Collection: meal_plans)
const MealPlan = mongoose.model('MealPlan', new mongoose.Schema({
  day: { type: String, unique: true },
  meal: String
}), 'meal_plans');

// 10. Standorte (Collection: locations)
const Location = mongoose.model('Location', new mongoose.Schema({
  memberName: { type: String, unique: true },
  location: String
}), 'locations');

// ---------------------------------------------------------------------------
// ENDPUNKTE (API)
// ---------------------------------------------------------------------------

// --- TASKS ---
app.get('/api/tasks', async (req, res) => res.json(await Task.find()));
app.post('/api/tasks', async (req, res) => res.json(await new Task(req.body).save()));
app.put('/api/tasks/:id', async (req, res) => {
  res.json(await Task.findByIdAndUpdate(req.params.id, req.body, { new: true }));
});
app.put('/api/tasks/:id/approve-xp', async (req, res) => {
  const { approverId } = req.body;
  if (approverId !== '1' && approverId !== '2') {
    return res.status(403).json({ error: 'Nur Mama und Vincent dürfen XP freigeben!' });
  }

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

// --- XP LEADERBOARD ---
app.get('/api/xp', async (req, res) => res.json(await UserXp.find()));

// --- EVENTS ---
app.get('/api/events', async (req, res) => res.json(await Event.find()));
app.post('/api/events', async (req, res) => res.json(await new Event(req.body).save()));
app.delete('/api/events/:id', async (req, res) => {
  await Event.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// --- CHAT MESSAGES ---
app.get('/api/messages', async (req, res) => res.json(await ChatMessage.find().sort({ timestamp: 1 })));
app.post('/api/messages', async (req, res) => res.json(await new ChatMessage(req.body).save()));

// --- FINANCES ---
app.get('/api/finances', async (req, res) => res.json(await Finance.find()));
app.post('/api/finances', async (req, res) => res.json(await new Finance(req.body).save()));

// --- SHOPPING ---
app.get('/api/shopping', async (req, res) => res.json(await ShoppingItem.find()));
app.post('/api/shopping', async (req, res) => res.json(await new ShoppingItem(req.body).save()));
app.put('/api/shopping/:id', async (req, res) => {
  res.json(await ShoppingItem.findByIdAndUpdate(req.params.id, { isBought: req.body.isBought }, { new: true }));
});

// --- LESSONS ---
app.get('/api/lessons', async (req, res) => res.json(await Lesson.find()));
app.post('/api/lessons', async (req, res) => res.json(await new Lesson(req.body).save()));
app.put('/api/lessons/:id', async (req, res) => res.json(await Lesson.findByIdAndUpdate(req.params.id, req.body, { new: true })));

// --- DOCUMENTS ---
app.get('/api/documents', async (req, res) => res.json(await Document.find()));
app.post('/api/documents', async (req, res) => res.json(await new Document(req.body).save()));
app.delete('/api/documents/:id', async (req, res) => {
  await Document.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// --- MEAL PLAN ---
app.get('/api/meals', async (req, res) => res.json(await MealPlan.find()));
app.put('/api/meals', async (req, res) => {
  const { day, meal } = req.body;
  const updated = await MealPlan.findOneAndUpdate({ day }, { meal }, { upsert: true, new: true });
  res.json(updated);
});

// --- LOCATIONS ---
app.get('/api/locations', async (req, res) => res.json(await Location.find()));
app.put('/api/locations', async (req, res) => {
  const { memberName, location } = req.body;
  const updated = await Location.findOneAndUpdate({ memberName }, { location }, { upsert: true, new: true });
  res.json(updated);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));