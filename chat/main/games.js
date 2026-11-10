const page = document.getElementById('page-main'); 
const gameContainer = document.getElementById('game-container'); 
import games from '../games.json' assert { type: 'json' };

games.forEach((game) => { 
  const btn = document.createElement('button'); 
  btn.classList.add('game-btn'); 
});
