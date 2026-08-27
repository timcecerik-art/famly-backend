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

// Schema für Aufgaben
const TaskSchema = new mongoose.Schema({
  title: String,
  assignedToMemberId: String,
  isDone: { type: Boolean, default: false }
});
const Task = mongoose.model('Task', TaskSchema);

// --- ENDPUNKTE ---

// 1. Alle Aufgaben abrufen
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await Task.find();
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Neue Aufgabe erstellen
app.post('/api/tasks', async (req, res) => {
  try {
    const newTask = new Task(req.body);
    await newTask.save();
    res.json(newTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Aufgabe abhak-Status ändern (Update)
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      { isDone: req.body.isDone },
      { new: true }
    );
    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));