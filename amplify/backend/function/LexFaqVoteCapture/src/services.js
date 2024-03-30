
/*
* Gets a random message to reply the user with based on their vote
*/
const getRandomReplyMessage = function (userVote) {
    let index = Math.floor(Math.random() * Math.floor(4));
    console.log("Inside getRandomReplyMessage() - printing userVote",userVote);

    let randomTexts;
    if (userVote === "Yes") {
        randomTexts = [
            "I am glad I was able to help",
            "This makes me so happy!!",
            "That's good to hear!",
            "Terrific! You just made my day"
        ];
    }
    else if (userVote === "No") {
        randomTexts = [
            "Oh, sorry! I wish I could have been of more help this time. I am going ahead and adding your question in my list of learning to-do's.",
            "Oh, sorry! Maybe I misunderstood your question. You want to try adding more context to your question?",
            "Shoot! I really wanted to help. Well one more item to the learning list. Goal is to get a little bit smarter every day.",
            "Sorry about that. Your question is definitely going to get me to do some research and try and get smarter." 
        ];
    }

    console.log("Inside getRandomReplyMessage() - printing randomTexts[index]", randomTexts[index]);
    return randomTexts[index];

};


module.exports = {
    getRandomReplyMessage
}