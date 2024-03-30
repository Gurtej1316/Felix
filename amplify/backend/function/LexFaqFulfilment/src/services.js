const AWS = require('aws-sdk');
AWS.config.update({ region: process.env.TABLE_REGION });
const dynamodb = new AWS.DynamoDB.DocumentClient();
const { CampaignReplies } = require('@commonutils/constants');
const lexUtils = require('@commonutils/lexUtils');
const { TableNames, FaqNotFoundMessages } = require('@commonutils/constants');
const {isUserLocked } = require('@commonutils/userLockService');

const doQuerySearch = async function (orgId,currentIntent) {
    let faqItem;
    try{
        //fetch from OrgFaqAnswer table
        let queryParams = {
            TableName: TableNames.FAQ_ANSWER,
            KeyConditionExpression: "#org = :orgId and #answerId = :faqAnswerId",
            ExpressionAttributeNames: {
              "#org": "orgId",
              "#answerId" : "faqAnswerId"
            },
            ExpressionAttributeValues: {
              ":orgId": orgId,
              ":faqAnswerId" : currentIntent
            }
        };
        
        // console.log("queryParams",queryParams);
        faqItem = await dynamodb.query(queryParams).promise();
        console.log("In doQuerySearch: faqItem",faqItem);
        if(faqItem && faqItem.Items && faqItem.Items[0]){
            faqItem = faqItem.Items[0];
        }
    
        return faqItem;
    }catch(error){
        console.log("ERROR: ",JSON.stringify(error));
        return faqItem; 
    }
};

const makeUserVoteRespCard  = async function () {
    //make the response card for user vote
    let faqResponse;
    let voteOptions = [];
    let tempJSON = {},tempJSON1 = {};
    tempJSON.text = "Yes"; 
    tempJSON.value = "FAQ Vote Yes";
    tempJSON1.text = "No";
    tempJSON1.value = "FAQ Vote No";
    
    voteOptions.push(tempJSON);
    voteOptions.push(tempJSON1);
    
    let cardMessage = "Was the response useful?";
    faqResponse = lexUtils.makeResponseCard(cardMessage,voteOptions);
    return faqResponse;
    // console.log("faqResponseCard",JSON.stringify(faqResponse));
};


/*
* Gets the random faq missed end message configured to make the responses more human
*/
const getRandomFaqNotFoundEndMessage = function () {
    if(FaqNotFoundMessages && FaqNotFoundMessages.length > 0){
        let messageCount = FaqNotFoundMessages.length;
        let messageIndex = Math.floor(Math.random() * Math.floor(messageCount));
        let campaignEndMessage = FaqNotFoundMessages[messageIndex]; 
        return campaignEndMessage;
    }else{
        return "Hmm, I do not know the answer for this one. Let me connect with the team and get back to you."; //making this as a default one to reply with
    }
};

/*
* Get response message for user considering if user is in locktime or not.
*/
const formResponse = async function (userData,message) {
    try{
        let isUserLockedFlag =  await isUserLocked(userData);
        console.log("In formResponse - isUserLockedFlag : ", isUserLockedFlag);
        if(isUserLockedFlag && userData.userCampaignsList && userData.userCampaignsList.length > 0){
            let ifActiveCampaign = false;
            for(const campaignObj of userData.userCampaignsList){
              if(campaignObj.campaignState === "Active" || campaignObj.campaignState === "InProgress"){
                ifActiveCampaign = true;
              }
            }
            if(ifActiveCampaign){
                message += ".\n\n"+ CampaignReplies.FAQ_REDIRECT_MESSAGE_FOR_LOCKED_USER;
            } 
        }
    }catch (error) {
        console.error(error);
    }
    return message;
};


const extractAndScaleSentimentVal = function (sentimentJSONStr) {
    var jsonStr = sentimentJSONStr.replace(/(\w+:)|(\w+ :)/g, function(matchedStr) {
      return '"' + matchedStr.substring(0, matchedStr.length - 1) + '":';
    });
    var sentimentObj = JSON.parse(jsonStr);
    let sentimentScore = sentimentObj.Positive*5 + sentimentObj.Negative*1 + sentimentObj.Neutral*3 + sentimentObj.Mixed*3; 
    return sentimentScore;
};

module.exports = {
    doQuerySearch,
    makeUserVoteRespCard,
    getRandomFaqNotFoundEndMessage,
    formResponse,
    extractAndScaleSentimentVal
}