require("dotenv").config();
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());

//mongodb connection
mongoose
  .connect(
    process.env.MONGODB_URL,
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => console.log("Connected to MongoDB"))
  .catch((error) => console.error("Failed to connect to MongoDB", error));

//task schema
const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  dueDate: {
    type: Date,
    required: true,
  },
  status: {
    type: Boolean,
    required: true,
    default: false,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
});

// User schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
});

// taks and user models
const Task = mongoose.model("Task", taskSchema);
const User = mongoose.model("User", userSchema);

// routes setup

// User registration
app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: "User registered successfully." });
  } catch (error) {
    res
      .status(500)
      .json({ error: "An error occurred while registering the user." });
  }
});

// User login
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid credentials." });
    }
    const token = jwt.sign({ userId: user._id }, "secretKey", {
      expiresIn: "1h",
    }); // Replace 'secretKey' with your own secret key
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: "An error occurred while logging in." });
  }
});

// Middleware for authentication requests

function authenticate(req, res, next) {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized access." });
  }
  jwt.verify(token, "secretKey", (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: "Invalid token." });
    }
    req.userId = decoded.userId;
    next();
  });
}

// CRUD operations for tasks

// tasks creation
app.post("/tasks", authenticate, async (req, res) => {
  try {
    const { title, description, dueDate } = req.body;
    const task = new Task({
      title,
      description,
      dueDate,
      status: false,
      userId: req.userId,
    });
    await task.save();
    res.status(201).json({ task });
  } catch (error) {
    res
      .status(500)
      .json({ error: "An error occurred while creating the task." });
  }
});

// Read all tasks
app.get("/tasks", authenticate, async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.userId });
    res.json({ tasks });
  } catch (error) {
    res
      .status(500)
      .json({ error: "An error occurred while retrieving tasks." });
  }
});

// Update a task
app.put("/tasks/:taskId", authenticate, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, description, dueDate, status } = req.body;
    const task = await Task.findOne({ _id: taskId, userId: req.userId });
    if (!task) {
      return res.status(404).json({ error: "Task not found." });
    }
    task.title = title;
    task.description = description;
    task.dueDate = dueDate;
    task.status = status;
    await task.save();
    res.json({ task });
  } catch (error) {
    res
      .status(500)
      .json({ error: "An error occurred while updating the task." });
  }
});

// Delete a task
app.delete("/tasks/:taskId", authenticate, async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await Task.findOne({ _id: taskId, userId: req.userId });
    if (!task) {
      return res.status(404).json({ error: "Task not found." });
    }
    await task.remove();
    res.json({ message: "Task deleted successfully." });
  } catch (error) {
    res
      .status(500)
      .json({ error: "An error occurred while deleting the task." });
  }
});

//  tasks by title
app.get("/tasks/search", authenticate, async (req, res) => {
  try {
    const { title } = req.query;
    const tasks = await Task.find({
      userId: req.userId,
      title: { $regex: title, $options: "i" },
    });
    res.json({ tasks });
  } catch (error) {
    res
      .status(500)
      .json({ error: "An error occurred while searching for tasks." });
  }
});

const PORT=process.env.PORT||5000;

app.listen(5000, () => {
  console.log("Server started on port 3000");
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "An error occurred." });
});
