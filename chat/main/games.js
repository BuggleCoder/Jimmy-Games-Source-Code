const page = document.getElementById('page-main');
const gameContainer = document.getElementById('game-container');

import games from "..games.json" with type="json";

games.forEach(() => {
    const btn = document.createElement('button');
    
    btn.addClass("game-btn");
    btn.id = game[i];
    ==
});