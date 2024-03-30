/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_CONVERSATIONS_ARN
	STORAGE_CONVERSATIONS_NAME
	STORAGE_CONVERSATIONS_STREAMARN
	STORAGE_ORGSTEP_ARN
	STORAGE_ORGSTEP_NAME
	STORAGE_ORGSTEP_STREAMARN
	STORAGE_ORGUSER_ARN
	STORAGE_ORGUSER_NAME
	STORAGE_ORGUSER_STREAMARN
	STORAGE_ORGWORKFLOW_ARN
	STORAGE_ORGWORKFLOW_NAME
	STORAGE_ORGWORKFLOW_STREAMARN
	STORAGE_ORG_ARN
	STORAGE_ORG_NAME
	STORAGE_ORG_STREAMARN
Amplify Params - DO NOT EDIT */
const lexUtils = require('@commonutils/lexUtils');
const services = require('./services');
const { updateUserToDB } = require('@dbutils/user');
const { CampaignReplies } = require('@commonutils/constants');
const { fetchStepFromDB } = require('@dbutils/step');
const { updateConversationToDB } = require('@dbutils/conversation'); 
const { getLastResponseForGivenConversation } = require('@searchutils/conversations');
const AWS = require('aws-sdk');
AWS.config.update({ region: process.env.TABLE_REGION });
const dynamodb = new AWS.DynamoDB.DocumentClient();
const commonService = require('@commonutils/services');
const teamsService = require('@commonutils/teamsService');
const utilityFunctions = require('./utility-functions');
const dbUtils = require('@dbutils/services');
/**
 * delegate the handling to the right base functions
 * @param {*} intentRequest 
 * @param {*} callback 
 * @returns 
*/
let userTableName = "OrgUser";
let campaignTableName = "OrgWorkflow";
let orgTableName = "Org";
if (process.env.ENV && process.env.ENV !== "NONE") {
  userTableName = userTableName + '-' + process.env.ENV;
  campaignTableName = campaignTableName + '-' + process.env.ENV;
  orgTableName = orgTableName + '-' + process.env.ENV;
}
const dispatchDialog = async function (intentRequest, callback) {
  
  try{
    let queryParams = {
      TableName: campaignTableName,
    };
  
    const campaignData = await dynamodb.scan(queryParams).promise();
    
    let userData;
    //checking userData exists in session, pick from there, or else, fetch from DB
    if(intentRequest.sessionAttributes && intentRequest.sessionAttributes['userData']){
      userData = JSON.parse(intentRequest.sessionAttributes['userData']);
    }else{
      userData = await lexUtils.checkIncomingSourceToFetchUserDetails(intentRequest);
    }

    if(userData){
      return processCampaignQuestions(intentRequest,userData, callback);
    }
    else{
      //no case matching for incoming source
      let sessionAttributes = {};
      let campaignReturn = lexUtils.closeDialog(sessionAttributes,CampaignReplies.DEFAULT_ERROR_MESSAGE);
      callback(campaignReturn);
      return ;
    }
      
  }catch (error) {
    console.error(error);
  }

};

const processCampaignQuestions = async function (intentRequest,userData, callback) {

  let intentName = intentRequest.currentIntent?.name;
  let outputSessionAttributes = intentRequest.sessionAttributes || {};
  let source = intentRequest.invocationSource;
  let slots = intentRequest.currentIntent?.slots;
  let campaignReturn;
  let responseCard;
  let campaignId;

  //double null check just in case there is an error passing this from caller method - we have a null check in dispatchDialog already
  if(!userData){
    console.log("No user Data found");
    campaignReturn = lexUtils.closeDialog(outputSessionAttributes,CampaignReplies.DEFAULT_ERROR_MESSAGE);
    console.log("campaignReturn", campaignReturn);
    callback(campaignReturn); 
    return ;
  }

  if(source === 'DialogCodeHook') {

    let userResponseText = intentRequest.inputTranscript; //geting user response
    let currQuestionObj,respObj;
    let sentimentVal,sentimentLabel;
    let updateParams;
    let message;

    if(userResponseText){
      if(outputSessionAttributes && !outputSessionAttributes['questionObj']){ //checking if 'questionObj' is in session variables or no

        //fetch last RESP row for the given campaign for the given user
        if(userData.lastPingEntityId){
          respObj = await getLastResponseForGivenConversation(userData.lastPingEntityId);
        }
        //fetch current question
        if(respObj && respObj.questionId){
          currQuestionObj = await fetchStepFromDB(userData.orgId,respObj.questionId);
          currQuestionObj = currQuestionObj && currQuestionObj.Item ? currQuestionObj.Item : undefined;
          campaignId = respObj.campaignId ? respObj.campaignId : undefined;
        }

      }else{
        //case when we are in the middle of a conversation
        currQuestionObj = JSON.parse(outputSessionAttributes['questionObj']);
        respObj = JSON.parse(outputSessionAttributes['respObj']);
        campaignId = outputSessionAttributes['campaignId'];
      }


      console.log("respObj and currQuestionObj",respObj,currQuestionObj);
      if(!respObj || !currQuestionObj || !campaignId){
        console.log("No RESP row or no question object or no campaign ID found");
        campaignReturn = lexUtils.closeDialog(outputSessionAttributes,CampaignReplies.DEFAULT_ERROR_MESSAGE);
        console.log("campaignReturn", campaignReturn);
        callback(campaignReturn);
        return ;
      }

      if(currQuestionObj.isSentimentCaptured){
        //only fill the two sentiment variables if sentiment capture is enabled for the question
        if(intentRequest.sentimentResponse){
          //saving sentiment analyis
          sentimentLabel = intentRequest.sentimentResponse.sentimentLabel;
          if(sentimentLabel === 'MIXED'){
            sentimentLabel = 'NEUTRAL';
          }
          sentimentVal = services.extractAndScaleSentimentVal(intentRequest.sentimentResponse.sentimentScore);
        }
      }

      console.log("sentiment values: ",sentimentLabel,sentimentVal);
      //save the answer to the last empty RESP row
      updateParams = {
        sentimentScore : sentimentVal ? sentimentVal : undefined,
        sentiment : sentimentLabel ? sentimentLabel : undefined,
        questionResponse : userResponseText
      };
      await updateConversationToDB(respObj.PK,respObj.SK,updateParams);  

      //fetch next question
      console.log("update done: ",userData.orgId,currQuestionObj.nextStepId);
      if (currQuestionObj.nextStepId) {
      
        let questionObj = await fetchStepFromDB(userData.orgId,currQuestionObj.nextStepId);
        questionObj = questionObj && questionObj.Item ? questionObj.Item : undefined;

        if(!questionObj || !questionObj.questionText){
          console.log("No question or questionText found");
          campaignReturn = lexUtils.closeDialog(outputSessionAttributes,CampaignReplies.DEFAULT_ERROR_MESSAGE); 
          console.log("campaignReturn", campaignReturn);
          callback(campaignReturn);
          return ;
        }

        //make next RESP row
        let newRespObj = await services.makeConversationResponse(userData, campaignId, questionObj, respObj.conversationId);  

        message = services.getRandomFillTexts(sentimentLabel) + " " + questionObj.questionText;
        let slotName = "questionResponses";

        //checking if the question has options configured
        if(questionObj.options && questionObj.options.length > 0){
          let responseCardOptionJSON = [];
          for(const option of questionObj.options){
            let tempJSON = {};
            tempJSON.text = option;
            tempJSON.value = option;
            responseCardOptionJSON.push(tempJSON);
          }
          responseCard = lexUtils.makeResponseCard(undefined,responseCardOptionJSON);
          campaignReturn = lexUtils.elicitSlot(outputSessionAttributes,intentName,slots,slotName,message,responseCard);

        }else{
          campaignReturn = lexUtils.elicitSlot(outputSessionAttributes,intentName,slots,slotName,message);
        }     

        //setting data into session before returning payload back to user
        outputSessionAttributes['userData'] = JSON.stringify(userData);
        outputSessionAttributes['questionObj'] = JSON.stringify(questionObj);
        outputSessionAttributes['campaignId'] = campaignId;  
        outputSessionAttributes['respObj'] = JSON.stringify(newRespObj);   
        
        //updating the 'lastInteractionDate' for the user
        updateParams = {
          lastInteractionDate : new Date().toISOString()
        };
        await updateUserToDB(userData.orgId,userData.userId,updateParams);

      } else {
        //no next question found case - end conversation
        console.log("No more questions - close conversation");
        outputSessionAttributes = {}; //empty the session before close

        //update the CONV row with status
        updateParams = {
          conversationStatus : "Completed"
        };
        let convSK = "CONV#" + campaignId + "#" + userData.userId + "#" + respObj.conversationId;
        await updateConversationToDB(respObj.PK,convSK,updateParams);

        //updating the 'lastInteractionDate', 'lastPingType' and 'lastPingEntityId' for the user
        updateParams = {
          lastInteractionDate : new Date().toISOString(),
          lastPingEntityId : "",
          lastPingType : ""
        };
        await updateUserToDB(userData.orgId,userData.userId,updateParams);

        message = sentimentLabel ? services.getRandomFillTexts(sentimentLabel) + " " + services.getRandomCampaignEndMessage() : services.getRandomCampaignEndMessage();
        campaignReturn = lexUtils.closeDialog(outputSessionAttributes,message);

      }

      
    }
    else{
      console.log("No user input found");
      campaignReturn = lexUtils.closeDialog(outputSessionAttributes,CampaignReplies.DEFAULT_ERROR_MESSAGE);
    }
  }
  else if (source === 'FulfillmentCodeHook') {
    console.error("In FulfillmentCodeHook section");
  }

  console.log("campaignReturn", JSON.stringify(campaignReturn));
  callback(campaignReturn);
};

module.exports = {
    dispatchDialog
};