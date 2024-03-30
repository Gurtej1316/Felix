const { insertConversationToDB } = require('@dbutils/conversation');
const dbUtils = require('@dbutils/services');
const {CampaignEndMessages} = require('@commonutils/constants');
const respPrefix = "RESP#";

const extractAndScaleSentimentVal = function (sentimentJSONStr) {
    var jsonStr = sentimentJSONStr.replace(/(\w+:)|(\w+ :)/g, function(matchedStr) {
      return '"' + matchedStr.substring(0, matchedStr.length - 1) + '":';
    });
    var sentimentObj = JSON.parse(jsonStr);
    let sentimentScore = sentimentObj.Positive*5 + sentimentObj.Negative*1 + sentimentObj.Neutral*3 + sentimentObj.Mixed*3; 
    return sentimentScore;
};

/*
* save conversation item to DB
*/
const makeConversationResponse = async function (userData, campaignId, questionObj,uniqueConvUUID) {
    const responseId = respPrefix + questionObj.stepId + "#" + userData.userId + "#" + uniqueConvUUID;
    let item = {
        "SK": responseId,
        "userId": userData.userId,
        "questionText": questionObj.questionText,
        "conversationId": uniqueConvUUID,
        "questionId": questionObj.stepId,
        "campaignId": campaignId,
        "momentId": questionObj.momentId,
        "sourceName" : "Berry",
        "sourceType" : "Internal"
    };
    let userDetailsToSave = await dbUtils.fetchListofUserAttributesToSave(userData.orgId,userData);
    if(userDetailsToSave){
        for(const [key,value] of Object.entries(userDetailsToSave)){
            if(key && value){
                item[key] = value;
            }
        }
    }
    console.log("Inside makeConversationResponse() - printing item : ", JSON.stringify(item));
    await insertConversationToDB(userData.orgId, item);
    return item;
};

/*
* Gets the random filler configured to make the questions more human
*/
const getRandomFillTexts = function (sentimentLabel) {
    let index = Math.floor(Math.random() * Math.floor(5));
    console.log("Inside getRandomFillTexts() - printing sentimentLabel and index", sentimentLabel, index);

    let randomTexts;
    if (sentimentLabel === "POSITIVE") {
        randomTexts = ["Nice.", "Great.", "Perfect.", "Great to hear.", "Cool."];
    }
    else if (sentimentLabel === "NEGATIVE") {
        randomTexts = ["Sorry to hear.", "Thank you for the transparency.", "I hear you.", "I can understand.", "It is really helpful to know that."];
    }
    else {
        randomTexts = ["Sure.", "Thank you.", "Got it.", "Noted.", "Understood."];
    }

    console.log("Inside getRandomFillTexts() - printing randomTexts[index]", randomTexts[index]);
    return randomTexts[index];

};
/*
* Gets the random Campaign end message configured to make the responses more human
*/
const getRandomCampaignEndMessage = function () {
    let messageCount = CampaignEndMessages.length;
    let messageIndex = Math.floor(Math.random() * Math.floor(messageCount));
    let campaignEndMessage = CampaignEndMessages[messageIndex]; 

    console.log("Inside getRandomCampaignEndMessage() - printing camapaign end message - ", campaignEndMessage , "and Index -" , messageIndex );
    return campaignEndMessage;
};

// const getCampaignStartMessage = async function(orgId,userCommChannel,campaignId){
//     let returnStr = undefined;
//     let campaignObj = await fetchWorkflowFromDB(orgId,campaignId);
//     // console.log("Inside getCampaignStartMessage-campaignObj",campaignObj);
//     if(campaignObj && campaignObj.campaignStartMessages){
//         //if no msg for comm channel of user, then chose first one in the list
//         returnStr = userCommChannel && campaignObj.campaignStartMessages[userCommChannel] ? campaignObj.campaignStartMessages[userCommChannel] : Object.entries(campaignObj.campaignStartMessages)[0][1]; 
//     }
//     return returnStr;
// };



module.exports = {
    extractAndScaleSentimentVal,
    getRandomFillTexts,
    getRandomCampaignEndMessage,
    makeConversationResponse
}