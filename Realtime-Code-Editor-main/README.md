# 🧠 Real-Time Code Editor

**RealTimeCodeEditor** is a dynamic, real-time collaborative code editor built using the **MERN stack** — **MongoDB**, **Express**, **React**, and **Node.js**. It allows multiple users to join the same coding session from anywhere in the world and collaborate live on code.  

With real-time typing indicators, user presence tracking, and language-based syntax highlighting, this project delivers a seamless experience for developers working together on shared code in real time.

---

## 🚀 Features

✅ **Real-Time Collaboration**  
- Multiple users can join a shared coding room using a unique Room ID.  
- Any change made by one user is instantly reflected for all participants.  

✅ **User Presence & Typing Indicator**  
- Displays the list of users currently active in the room.  
- Shows “User is typing…” when someone is editing code in real time.  

✅ **Multi-Language Support**  
- Choose from popular languages such as **JavaScript**, **Python**, **Java**, and **C++**.  
- The editor automatically adjusts syntax highlighting and environment configuration based on the selected language.  

✅ **Responsive UI**  
- Fully responsive interface designed to work smoothly on both desktop and mobile devices.  

✅ **Seamless User Experience**  
- Clean layout and minimal design for distraction-free coding.  

---

## 🌐 Live Demo

🔗 **Hosted Link (Vercel):** [https://real-time-code-compiler-frontend.vercel.app/]  
🕐 *(Please wait ~10 seconds for the first load due to cold start)*  

---

## 🧑‍💻 Tech Stack

| Layer | Technology |
|-------|-------------|
| Frontend | React.js, HTML5, CSS3 |
| Backend | Node.js, Express.js |
| Real-Time Communication | Socket.IO |
| Code Editor | CodeMirror / Monaco Editor |
| Hosting | Vercel |

---

## 🧩 How It Works

1. A user creates or joins a coding room using a **unique Room ID**.  
2. The app connects all participants using **Socket.IO** for live synchronization.  
3. Any text change is broadcast instantly to all connected users.  
4. When a user selects a programming language, the editor automatically updates syntax highlighting and formatting.  

---

## 🛠️ Setup Instructions

Follow these steps to run the project locally:

```bash
# 1. Clone the repository
git clone https://github.com/Durgesh1008/RealTimeCodeEditor.git

# 2. Navigate into the project directory
cd RealTimeCodeEditor

# 3. Install dependencies for both client and server
cd client && npm install
cd ../server && npm install

# 4. Set up environment variables
# Create a .env file in the server directory and configure MongoDB URI and PORT

# 5. Start the development servers
cd client && npm start
cd ../server && npm run dev
