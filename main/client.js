const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const socket = new WebSocket(`${protocol}//${window.location.host}`);

const heading = document.getElementById('heading');
const page = document.getElementById('page')

socket.onopen = () => {};

