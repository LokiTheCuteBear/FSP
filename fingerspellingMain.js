let wordToGuess, wordList;
let score = 0;

//UI Elements
const userGuessInput = document.getElementById("guessword-input");
const scoreDisplay = document.getElementById("score-display");

async function loadWordList() {
    wordList = await fetch('wordList').then(res => res.text()).then(text => text.split("\n"))
    wordToGuess = pickRandomWord(); //initialize a word to guess right off the bat
    console.log(`Word to guess: ${wordToGuess}`)
}

//pick a random index in the array and clean up the string to not contain any newlines
function pickRandomWord(){
    return wordList[Math.floor(Math.random() * wordList.length)].replace( /[\r\n]+/gm, "" ); 
}

function setNewWordToGuess(){
    wordToGuess = pickRandomWord();
    console.log(`Word to guess: ${wordToGuess}`)
}

function checkWordGuess(){
    userGuess = userGuessInput.value;

    if(userGuess == wordToGuess){
        setNewWordToGuess();    
        score++;
    }
    else{
        score--;
    }

    //update UI elements
    userGuessInput.value = ""
    scoreDisplay.innerHTML = `Score: ${score}`
}

//handle users checking the word to guess by pressing the Enter key
userGuessInput.addEventListener("keyup", function(event) {
  if (event.keyCode === 13) {
    event.preventDefault();
    document.getElementById("check-button").click();
  }
});

function initFingerspelling(){
    fingerspell(wordToGuess)

    //TODO: update UI elements to reflect animation in process
}

loadWordList();
