const heading = document.getElementById("heading");
const page = document.getElementById("page");
const chatForm = document.getElementById("chat-form");
const chatFormInput = document.getElementById("chat-input");
const chatContainer = document.getElementById("chat-container");

const setupContainer = document.getElementById("setup-container");
const setupForm = document.getElementById("setup-form");
const usernameInput = document.getElementById("username-input");
const passwordInput = document.getElementById("password-input");
const authTitle = document.getElementById("auth-title");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const toggleAuthBtn = document.getElementById("toggle-auth-mode");
const authError = document.getElementById("auth-error");

let username = "";
let playerId = null;
let socket = null;
let isRegisterMode = false;

toggleAuthBtn.addEventListener("click", () => {
  isRegisterMode = !isRegisterMode;
  authTitle.textContent = isRegisterMode ? "Create Account" : "Sign In";
  authSubmitBtn.textContent = isRegisterMode ? "Register" : "Sign In";
  toggleAuthBtn.textContent = isRegisterMode
    ? "Already have an account? Sign In"
    : "Need an account? Register";
  authError.textContent = "";
});

window.addEventListener("DOMContentLoaded", () => {
  const savedToken = localStorage.getItem("auth_token");
  if (savedToken) {
    initWebSocket(savedToken);
  }
});

setupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";

  const chosenName = usernameInput.value.trim();
  const password = passwordInput.value;
  if (!chosenName || !password) return;

  const endpoint = isRegisterMode ? "/api/register" : "/api/login";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: chosenName, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      authError.textContent = data.error || "Authentication failed";
      return;
    }

    if (isRegisterMode) {
      isRegisterMode = false;
      setupForm.dispatchEvent(new Event("submit"));
      return;
    }

    localStorage.setItem("auth_token", data.token);
    enterGame(data.username, data.token);
  } catch (err) {
    authError.textContent = "Server error. Please try again.";
    console.error(err);
  }
});

function enterGame(confirmedUsername, token) {
  username = confirmedUsername;
  heading.textContent = `Welcome, ${username}!`;
  setupContainer.style.display = "none";
  page.style.display = "block";
  initWebSocket(token);
}

function initWebSocket(token) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${window.location.host}/?token=${encodeURIComponent(token)}`);

  socket.onopen = () => {
    console.log("Connected to server");
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case "init":
          playerId = data.id;
          username = data.username;
          heading.textContent = `Welcome, ${username}!`;
          setupContainer.style.display = "none";
          page.style.display = "block";
          console.log("My Player ID:", playerId);
          break;
        case "history":
          loadHistory(data.messages);
          break;
        case "chat":
          addMessage(data.id || username, data.text);
          break;
        case "state":
          break;
        default:
          console.log("Unknown message:", data);
      }
    } catch (error) {
      console.error("Message parsing error:", error);
    }
  };

  socket.onclose = (event) => {
    console.log("Disconnected from server");
    if (event.code === 4001) {
      localStorage.removeItem("auth_token");
      page.style.display = "none";
      setupContainer.style.display = "block";
      authError.textContent = "Session expired. Please sign in again.";
    }
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };
}

function addMessage(sender, text) {
  if (!chatContainer) return;
  const message = document.createElement("p");
  message.className = "chat-msg";
  message.textContent = `${sender}: ${text}`;
  chatContainer.insertAdjacentElement("beforeend",message);
}

function loadHistory(messages) {
  chatContainer.replaceChildren();
  messages.forEach((msg) => {
    addMessage(msg.id, msg.text);
  });
  chatContainer.scrollTop = chatContainer.scrollHeight;
  console.log(`Loaded ${messages.length} messages`);
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = chatFormInput.value.trim();
  if (!text) return;

  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.error("WebSocket is not connected!");
    return;
  }

  socket.send(
    JSON.stringify({
      type: "chat",
      text,
    }),
  );
  chatFormInput.value = "";
});
