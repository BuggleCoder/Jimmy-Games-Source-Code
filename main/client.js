
const heading = document.getElementById('heading');
const page = document.getElementById('page');
const chatForm = document.getElementById('chat-form');
const chatFormInput = document.getElementById('chat-input');
const chatContainer = document.getElementById('chat-container');

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const socket = new WebSocket(`${protocol}//${window.location.host}`);

let playerId = null;

function addMessage(sender, text) {
    if (!chatContainer) {
        console.error('chat-container element not found!');
        return;
    }

    const message = document.createElement('p');

    message.className = 'chat-msg';
    message.textContent = `${sender}: ${text}`;

    chatContainer.appendChild(message);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

socket.onopen = () => {
    console.log('Connected to server');

    socket.send(JSON.stringify({
        type: 'chat',
        text: 'Hello from client!'
    }));
};

socket.onmessage = (event) => {
    console.log('SERVER MESSAGE:', event.data);

    try {
        const data = JSON.parse(event.data);

        switch (data.type) {
            case 'init':
                playerId = data.id;
                console.log('My Player ID:', playerId);
                break;

            case 'chat':
                addMessage(data.id, data.text);
                break;

            case 'state':
                console.log('Players:', data.players);
                break;

            default:
                console.log('Unknown server message:', data);
        }

    } catch (error) {
        console.error('Message parsing error:', error);
    }
};

socket.onclose = () => {
    console.log('Disconnected from server');
};

socket.onerror = (error) => {
    console.error('WebSocket error:', error);
};

if (chatForm && chatFormInput) {
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const text = chatFormInput.value.trim();

        if (!text) return;

        if (socket.readyState !== WebSocket.OPEN) {
            console.error('WebSocket is not connected!');
            return;
        }

        socket.send(JSON.stringify({
            type: 'chat',
            text
        }));

        chatFormInput.value = '';
    });
} else {
    alert('Chat form or input not found!');
}

console.log('Chat container:', chatContainer);
console.log('Chat form:', chatForm);
console.log('Chat input:', chatFormInput);