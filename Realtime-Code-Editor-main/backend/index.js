import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { exec } from "child_process";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { GoogleGenAI } from "@google/genai";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
const app = express();
const server = http.createServer(app);
app.use(express.json());
app.use(cors());
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});


const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY, 
});

const rooms = new Map(); 
const chatUsers = new Map();

// Create temp directory if it doesn't exist
const tempDir = path.join(process.cwd(), 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// --- UTILITY FUNCTIONS ---
const executeCode = (code, language, callback) => {
 
  const fileId = uuidv4();
  let fileName, command;

  try {
    switch (language) {
      case 'javascript':
        fileName = `${fileId}.js`;
        fs.writeFileSync(path.join(tempDir, fileName), code);
        command = `node ${path.join(tempDir, fileName)}`;
        break;
      case 'python':
        fileName = `${fileId}.py`;
        fs.writeFileSync(path.join(tempDir, fileName), code);
        command = `python3 ${path.join(tempDir, fileName)}`;
        break;
      case 'java':
        fileName = `${fileId}.java`;
        const classMatch = code.match(/public\s+class\s+(\w+)/);
        const className = classMatch ? classMatch[1] : 'Main';
        const javaCode = classMatch ? code : `public class Main {\n${code}\n}`;

        fs.writeFileSync(path.join(tempDir, `${className}.java`), javaCode);
        command = `cd ${tempDir} && javac ${className}.java && java ${className}`;
        break;
      case 'cpp':
        fileName = `${fileId}.cpp`;
        fs.writeFileSync(path.join(tempDir, fileName), code);
        const executableName = `${fileId}`;
        command = `cd ${tempDir} && g++ ${fileName} -o ${executableName} && ./${executableName}`;
        break;
      default:
        return callback({ error: 'Unsupported language' });
    }

    const childProcess = exec(command, { timeout: 10000 }, (error, stdout, stderr) => {
      // Cleanup files
      try {
        if (language === 'java') {
          const classMatch = code.match(/public\s+class\s+(\w+)/);
          const className = classMatch ? classMatch[1] : 'Main';
          fs.unlinkSync(path.join(tempDir, `${className}.java`));
          if (fs.existsSync(path.join(tempDir, `${className}.class`))) {
            fs.unlinkSync(path.join(tempDir, `${className}.class`));
          }
        } else if (language === 'cpp') {
          fs.unlinkSync(path.join(tempDir, fileName));
          if (fs.existsSync(path.join(tempDir, fileId))) {
            fs.unlinkSync(path.join(tempDir, fileId));
          }
        } else {
          fs.unlinkSync(path.join(tempDir, fileName));
        }
      } catch (cleanupError) {
        console.log('Cleanup error:', cleanupError.message);
      }

      if (error) {
        if (error.killed && error.signal === 'SIGTERM') {
          callback({ error: 'Code execution timed out (10 seconds limit)' });
        } else {
          callback({ error: stderr || error.message });
        }
      } else {
        callback({ output: stdout, error: stderr });
      }
    });

  } catch (err) {
    callback({ error: `File system error: ${err.message}` });
  }
};

function getUsersInRoom(roomId) {
  const roomUsers = [];
  for (let [id, user] of chatUsers) {
    if (user.roomId === roomId) {
      roomUsers.push(user.username);
    }
  }
  return roomUsers;
}


// --- SINGLE, UNIFIED CONNECTION HANDLER (THE FIX) ---
io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);

  // Context for Code Editor features (Your original variables)
  let currentCodeRoom = null;
  let currentCodeUser = null;

  // ====================================================================
  // 1. CODE EDITOR/COMPILER LOGIC
  // ====================================================================

  // Handle joining a room (for Code Editor/Compiler)
  socket.on("join", ({ roomId, userName }) => {
    if (currentCodeRoom) {
      socket.leave(currentCodeRoom);
      if (rooms.has(currentCodeRoom) && rooms.get(currentCodeRoom).users.has(currentCodeUser)) {
        rooms.get(currentCodeRoom).users.delete(currentCodeUser);
      }
    }

    currentCodeRoom = roomId;
    currentCodeUser = userName;

    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        users: new Set(),
        code: "// start code here",
        language: "javascript"
      });
    }

    rooms.get(roomId).users.add(userName);

    // Emit the current code and language to the new user
    socket.emit("codeUpdate", rooms.get(roomId).code);
    socket.emit("languageUpdate", rooms.get(roomId).language);

    // Emit the updated user list to the room
    io.to(roomId).emit("userJoined", Array.from(rooms.get(roomId).users));
  });

  // Handle code changes from users
  socket.on("codeChange", ({ roomId, code }) => {
    if (rooms.has(roomId)) {
      rooms.get(roomId).code = code;
      socket.to(roomId).emit("codeUpdate", code); // Don't emit back to sender
    }
  });

  // Handle user typing indication
  socket.on("typing", ({ roomId, userName }) => {
    socket.to(roomId).emit("userTyping", userName);
  });

  // Handle language change
  socket.on("languageChange", ({ roomId, language }) => {
    if (rooms.has(roomId)) {
      rooms.get(roomId).language = language;
      io.to(roomId).emit("languageUpdate", language);
    }
  });

  // Handle code execution
  socket.on("runCode", ({ roomId, code, language }) => {
    console.log(`Running ${language} code for room ${roomId}`);
    io.to(roomId).emit("codeRunning", { user: currentCodeUser }); // Using currentCodeUser

    executeCode(code, language, (result) => {
      io.to(roomId).emit("codeResult", {
        user: currentCodeUser, // Using currentCodeUser
        output: result.output || '',
        error: result.error || '',
        timestamp: new Date().toLocaleTimeString()
      });
    });
  });

  // Handle leaving a room
  socket.on("leaveRoom", () => {
    if (currentCodeRoom && currentCodeUser) {
      if (rooms.has(currentCodeRoom)) {
        rooms.get(currentCodeRoom).users.delete(currentCodeUser);
        io.to(currentCodeRoom).emit("userJoined", Array.from(rooms.get(currentCodeRoom).users));
      }

      socket.leave(currentCodeRoom);
      currentCodeRoom = null;
      currentCodeUser = null;
    }
  });


  // ====================================================================
  // 2. CHAT BOT LOGIC (Now correctly integrated)
  // ====================================================================

  // When a user joins the chat
  socket.on("joinChat", ({ username, roomId }) => {
    chatUsers.set(socket.id, { username, roomId });
    socket.join(roomId);
    console.log(`${username} joined chat room: ${roomId}`);

    io.to(roomId).emit("users", getUsersInRoom(roomId));
    io.to(roomId).emit("message", {
      sender: "System",
      text: `${username} joined the chat`,
      time: new Date(),
    });
  });

  // When a message is sent (The Chat FIX)
  socket.on("message", (msgData) => {
    const user = chatUsers.get(socket.id);
    if (!user) return; // User must have joined chat using 'joinChat'

    const msg = {
      sender: user.username,
      text: msgData.text,
      time: new Date(),
      roomId: user.roomId,
    };

    // Correctly broadcast to ALL in the room (including sender)
    io.to(user.roomId).emit("message", msg);
  });

  // Handle Disconnection (Merged Cleanup)
  socket.on("disconnect", () => {
    // 1. Clean up Chat User
    const chatUser = chatUsers.get(socket.id);
    if (chatUser) {
      const { username, roomId } = chatUser;
      chatUsers.delete(socket.id);

      io.to(roomId).emit("users", getUsersInRoom(roomId));
      io.to(roomId).emit("message", {
        sender: "System",
        text: `${username} left the chat`,
        time: new Date(),
      });
    }

    // 2. Clean up Code Editor User
    if (currentCodeRoom && currentCodeUser && rooms.has(currentCodeRoom)) {
      rooms.get(currentCodeRoom).users.delete(currentCodeUser);
      io.to(currentCodeRoom).emit("userJoined", Array.from(rooms.get(currentCodeRoom).users));
    }

    console.log("User Disconnected:", socket.id);
  });
});

app.post("/ai/fix-code", async (req, res) => {
  const { code, error, language } = req.body;

  // Ensure req.body is printed correctly for debugging
  console.log("Received AI fix-code request. Body:", req.body);

  try {
    // Using a system instruction for context and role
    const systemInstruction = `You are an expert ${language} developer. Your task is to analyze the provided code and error, then provide a clear explanation and the corrected code. You must respond ONLY with a single JSON object.`;

    const userPrompt = `
Here is some code that produced an error:

--- CODE ---
${code}
--- END CODE ---

--- ERROR ---
${error}
--- END ERROR ---

Please:
1️⃣ Explain the cause of the error clearly.
2️⃣ Provide corrected code.
Respond in JSON like this:
{
  "explanation": "why it happened",
  "fixedCode": "corrected code"
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Fast, powerful, and cost-effective model
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json", // Instructs the model to return a single JSON object
      },
    });

    // The response text is a JSON string because of responseMimeType
    let reply = response.text;
    let json;

    try {
      json = JSON.parse(reply);
    } catch (e) {
      console.error("Failed to parse Gemini JSON response:", e);
      // Fallback in case of parsing failure
      json = { explanation: reply, fixedCode: "" };
    }

    res.json(json);
  } catch (err) {
    console.error("Gemini API Error:", err.message);
    // Send specific error details to the frontend
    res.status(500).json({ error: err.message });
  }
});


const port = process.env.PORT || 5000;
const __dirname = path.resolve();

app.use(express.static(path.join(__dirname, "/frontend/dist")));

server.listen(port, () => {
  console.log(`Server is working on port ${port}`);
});