const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB Verbindung (Verwendet Environment Variable oder Fallback-URI)
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://timcecerik_db_user:Timcecerik1906@famly.r2auhfs.mongodb.net/famly?retryWrites=true&w=majority";

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

// 3. Shop / Belohnungsanfragen (Collection: reward_requests)
const RewardRequest = mongoose.model('RewardRequest', new mongoose.Schema({
  memberId: String,
  memberName: String,
  title: String,
  xpCost: Number,
  status: { type: String, default: 'pending' }, // 'pending', 'approved'
  createdAt: { type: Date, default: Date.now }
}), 'reward_requests');

// 4. Termine (Collection: events)
const Event = mongoose.model('Event', new mongoose.Schema({
  title: String,
  date: Date,
  createdByMemberId: String
}), 'events');

// 5. Chat (Collection: chat_messages)
const ChatMessage = mongoose.model('ChatMessage', new mongoose.Schema({
  senderName: String,
  text: String,
  timestamp: { type: Date, default: Date.now }
}), 'chat_messages');

// 6. Finanzen (Collection: finances)
const Finance = mongoose.model('Finance', new mongoose.Schema({
  title: String,
  amount: Number,
  isExpense: Boolean
}), 'finances');

// 7. Einkaufsliste (Collection: shopping_items)
const ShoppingItem = mongoose.model('ShoppingItem', new mongoose.Schema({
  title: String,
  isBought: { type: Boolean, default: false }
}), 'shopping_items');

// 8. Stundenplan (Collection: schedule_lessons) - NEU MIT PERIOD & TIMESLOT
const LessonSchema = new mongoose.Schema({
  memberId: String,
  day: String,             // 'Montag', 'Dienstag', etc.
  period: Number,          // 1 bis 9 für die jeweilige Stunde
  timeSlot: String,        // z.B. '07:55 - 08:40'
  subject: String,         // z.B. 'Mathematik'
  room: String,            // z.B. 'Raum 102'
  isCanceled: { type: Boolean, default: false }
});
const Lesson = mongoose.model('Lesson', LessonSchema, 'schedule_lessons');

// 9. Dokumente (Collection: documents)
const Document = mongoose.model('Document', new mongoose.Schema({
  name: String
}), 'documents');

// 10. Essensplan (Collection: meal_plans)
const MealPlan = mongoose.model('MealPlan', new mongoose.Schema({
  day: { type: String, unique: true },
  meal: String
}), 'meal_plans');

// 11. Standorte (Collection: locations)
const Location = mongoose.model('Location', new mongoose.Schema({
  memberName: { type: String, unique: true },
  location: String
}), 'locations');

// ---------------------------------------------------------------------------
// ENDPUNKTE (API)
// ---------------------------------------------------------------------------

// --- TASKS & XP ---
app.get('/api/tasks', async (req, res) => res.json(await Task.find()));
app.post('/api/tasks', async (req, res) => res.json(await new Task(req.body).save()));
app.put('/api/tasks/:id', async (req, res) => {
  res.json(await Task.findByIdAndUpdate(req.params.id, req.body, { new: true }));
});
app.delete('/api/tasks/:id', async (req, res) => {
  await Task.findByIdAndDelete(req.params.id);
  res.json({ success: true });
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

  // Automatische Wiederholung für Folgetage/Folgewochen
  if (task.recurring && task.recurring !== 'none' && task.dueDate) {
    const nextDate = new Date(task.dueDate);
    if (task.recurring === 'daily') {
      nextDate.setDate(nextDate.getDate() + 1);
    } else if (task.recurring === 'weekly') {
      nextDate.setDate(nextDate.getDate() + 7);
    }

    await new Task({
      title: task.title,
      assignedToMemberId: task.assignedToMemberId,
      createdByMemberId: task.createdByMemberId,
      isDone: false,
      dueDate: nextDate,
      timeSlot: task.timeSlot,
      recurring: task.recurring,
      estimatedMinutes: task.estimatedMinutes,
      xpApproved: false
    }).save();
  }

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

app.put('/api/rewards/approve/:id', async (req, res) => {
  const { approverId } = req.body;
  if (approverId !== '1') {
    return res.status(403).json({ error: 'Nur Mama kann Belohnungen freigeben!' });
  }

  const reqItem = await RewardRequest.findById(req.params.id);
  if (!reqItem || reqItem.status !== 'pending') return res.json(reqItem);

  reqItem.status = 'approved';
  await reqItem.save();

  await UserXp.findOneAndUpdate(
    { memberId: reqItem.memberId },
    { $inc: { xp: -reqItem.xpCost } }
  );

  res.json(reqItem);
});

// --- STUNDENPLAN (LESSONS) ---
app.get('/api/lessons', async (req, res) => res.json(await Lesson.find()));
app.post('/api/lessons', async (req, res) => res.json(await new Lesson(req.body).save()));
app.put('/api/lessons/:id', async (req, res) => res.json(await Lesson.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.delete('/api/lessons/:id', async (req, res) => {
  await Lesson.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

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