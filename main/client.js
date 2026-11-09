const socket = new WebSocket('wss://sturdy-train-q7j4777qp7v4hx966-8080.app.github.dev/');

socket.onopen = () => {
    console.log('Connected to Codespaces server!');
    socket.send(JSON.stringify({ type: 'chat', text: 'Hello!' }));
};

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    document.getElementById('msg').textContent = (`Message from server:', ${data}`);
};
