const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB Verbindung
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://timcecerik_db_user:Timcecerik1906@famly.r2auhfs.mongodb.net/"

mongoose.connect(MONGO_URI)
  .then(() => console.log("Mit MongoDB verbunden!"))
  .catch(err => console.error("MongoDB Fehler:", err));

// ---------------------------------------------------------------------------
// MONGOOSE SCHEMAS & MODELS (Klar benannte Collections in Atlas)
// ---------------------------------------------------------------------------

// 1. Aufgaben (Collection: tasks)
const Task = mongoose.model('Task', new mongoose.Schema({
  title: String,
  assignedToMemberId: String,
  isDone: { type: Boolean, default: false }
}), 'tasks');

// 2. Termine (Collection: events)
const Event = mongoose.model('Event', new mongoose.Schema({
  title: String,
  date: Date,
  createdByMemberId: String
}), 'events');

// 3. Nachrichten / Chat (Collection: chat_messages)
const ChatMessage = mongoose.model('ChatMessage', new mongoose.Schema({
  senderName: String,
  text: String,
  timestamp: { type: Date, default: Date.now }
}), 'chat_messages');

// 4. Finanzen (Collection: finances)
const Finance = mongoose.model('Finance', new mongoose.Schema({
  title: String,
  amount: Number,
  isExpense: Boolean
}), 'finances');

// 5. Einkaufsliste (Collection: shopping_items)
const ShoppingItem = mongoose.model('ShoppingItem', new mongoose.Schema({
  title: String,
  isBought: { type: Boolean, default: false }
}), 'shopping_items');

// 6. Stundenplan (Collection: schedule_lessons)
const Lesson = mongoose.model('Lesson', new mongoose.Schema({
  memberId: String,
  day: String,
  time: String,
  subject: String,
  room: String,
  isCanceled: { type: Boolean, default: false }
}), 'schedule_lessons');

// 7. Dokumente (Collection: documents)
const Document = mongoose.model('Document', new mongoose.Schema({
  name: String
}), 'documents');

// 8. Essensplan (Collection: meal_plans)
const MealPlan = mongoose.model('MealPlan', new mongoose.Schema({
  day: { type: String, unique: true },
  meal: String
}), 'meal_plans');

// 9. Standorte (Collection: locations)
const Location = mongoose.model('Location', new mongoose.Schema({
  memberName: { type: String, unique: true },
  location: String
}), 'locations');

// ---------------------------------------------------------------------------
// ENDPUNKTE (API)
// ---------------------------------------------------------------------------

// --- 1. TASKS ---
app.get('/api/tasks', async (req, res) => res.json(await Task.find()));
app.post('/api/tasks', async (req, res) => res.json(await new Task(req.body).save()));
app.put('/api/tasks/:id', async (req, res) => {
  res.json(await Task.findByIdAndUpdate(req.params.id, { isDone: req.body.isDone }, { new: true }));
});

// --- 2. EVENTS ---
app.get('/api/events', async (req, res) => res.json(await Event.find()));
app.post('/api/events', async (req, res) => res.json(await new Event(req.body).save()));
app.delete('/api/events/:id', async (req, res) => {
  await Event.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// --- 3. CHAT MESSAGES ---
app.get('/api/messages', async (req, res) => res.json(await ChatMessage.find().sort({ timestamp: 1 })));
app.post('/api/messages', async (req, res) => res.json(await new ChatMessage(req.body).save()));

// --- 4. FINANCES ---
app.get('/api/finances', async (req, res) => res.json(await Finance.find()));
app.post('/api/finances', async (req, res) => res.json(await new Finance(req.body).save()));

// --- 5. SHOPPING ITEMS ---
app.get('/api/shopping', async (req, res) => res.json(await ShoppingItem.find()));
app.post('/api/shopping', async (req, res) => res.json(await new ShoppingItem(req.body).save()));
app.put('/api/shopping/:id', async (req, res) => {
  res.json(await ShoppingItem.findByIdAndUpdate(req.params.id, { isBought: req.body.isBought }, { new: true }));
});

// --- 6. LESSONS ---
app.get('/api/lessons', async (req, res) => res.json(await Lesson.find()));
app.post('/api/lessons', async (req, res) => res.json(await new Lesson(req.body).save()));
app.put('/api/lessons/:id', async (req, res) => res.json(await Lesson.findByIdAndUpdate(req.params.id, req.body, { new: true })));

// --- 7. DOCUMENTS ---
app.get('/api/documents', async (req, res) => res.json(await Document.find()));
app.post('/api/documents', async (req, res) => res.json(await new Document(req.body).save()));
app.delete('/api/documents/:id', async (req, res) => {
  await Document.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// --- 8. MEAL PLAN ---
app.get('/api/meals', async (req, res) => res.json(await MealPlan.find()));
app.put('/api/meals', async (req, res) => {
  const { day, meal } = req.body;
  const updated = await MealPlan.findOneAndUpdate({ day }, { meal }, { upsert: true, new: true });
  res.json(updated);
});

// --- 9. LOCATIONS ---
app.get('/api/locations', async (req, res) => res.json(await Location.find()));
app.put('/api/locations', async (req, res) => {
  const { memberName, location } = req.body;
  const updated = await Location.findOneAndUpdate({ memberName }, { location }, { upsert: true, new: true });
  res.json(updated);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));