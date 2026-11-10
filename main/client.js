const heading = document.getElementById("heading");
const page = document.getElementById("page");

const chatForm = document.getElementById("chat-form");
const chatFormInput = document.getElementById("chat-input");
const chatContainer = document.getElementById("chat-container");

let username = "";

const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const socket = new WebSocket(`${protocol}//${window.location.host}`);

let playerId = null;

function addMessage(sender, text) {
  if (!chatContainer) return;

  const message = document.createElement("p");

  message.className = "chat-msg";
  message.textContent = `${sender}: ${text}`;

  chatContainer.appendChild(message);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function loadHistory(messages) {
  chatContainer.replaceChildren();

  messages.forEach((msg) => {
    addMessage(msg.id, msg.text);
  });

  chatContainer.scrollTop = chatContainer.scrollHeight;

  console.log(`Loaded ${messages.length} messages`);
}

socket.onopen = () => {
  console.log("Connected to server");
};

socket.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);

    switch (data.type) {
      case "init":
        playerId = data.id;
        console.log("My Player ID:", playerId);
        break;

      case "history":
        loadHistory(data.messages);
        break;

      case "chat":
        addMessage(data.id || username, data.text);
        break;

      case "state":
        console.log("Players:", data.players);
        break;

      default:
        console.log("Unknown message:", data);
    }
  } catch (error) {
    console.error("Message parsing error:", error);
  }
};

socket.onclose = () => {
  console.log("Disconnected from server");
};

socket.onerror = (error) => {
  console.error("WebSocket error:", error);
};

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = chatFormInput.value.trim();

  if (!text) return;

  if (socket.readyState !== WebSocket.OPEN) {
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
