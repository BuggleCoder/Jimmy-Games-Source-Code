const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const socket = new WebSocket(`${protocol}//${window.location.host}`);

socket.onopen = () => {
    console.log('Connected to server!');
    socket.send(JSON.stringify({ type: 'chat', text: 'Hello from client!' }));
};

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'init') {
        console.log('My Player ID:', data.id);
    }
};
