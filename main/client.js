const heading = document.getElementById('heading');
const page = document.getElementById('page')


const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const socket = new WebSocket(`${protocol}//${window.location.host}`);

socket.onopen = () => {
    inputField.addEventListener("input", function (event) {
        const textValue = event.target.value;
        output.textContent = "You typed: " + textValue;
    });
    socket.send(JSON.stringify({ type: 'chat', text: 'Hello from client!' }));
};

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'init') {
        console.log('My Player ID:', data.id);
    }
};
