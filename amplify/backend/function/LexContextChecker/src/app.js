/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_ORGUSER_ARN
	STORAGE_ORGUSER_NAME
	STORAGE_ORGUSER_STREAMARN
	STORAGE_ORG_ARN
	STORAGE_ORG_NAME
	STORAGE_ORG_STREAMARN
Amplify Params - DO NOT EDIT */

const lexUtils = require('@commonutils/lexUtils');
const {isUserLocked } = require('@commonutils/userLockService');
const { CampaignReplies } = require('@commonutils/constants');

/**
 * delegate the handling to the right base functions
 * @param {*} intentRequest 
 * @param {*} callback 
 * @returns 
*/
const dispatchDialog = async function (intentRequest, callback) {
try{
    let userData = await lexUtils.checkIncomingSourceToFetchUserDetails(intentRequest);
    // console.log(" intentRequest",intentRequest);   

    if(userData){
      return processSmallTalkRequests(intentRequest, userData, callback);

    }else{
      //no user object found in DB
      let sessionAttributes = {};
      let slots = intentRequest.currentIntent?.slots;
      slots.inCampaignResponse = "";
      let campaignReturn = lexUtils.closeDialog(sessionAttributes,CampaignReplies.DEFAULT_ERROR_MESSAGE);
      callback(campaignReturn);   
      return ;
    }

  }catch (error) {
    console.error(error);
  }

};

const processSmallTalkRequests = async function (intentRequest, userData, callback) {
  let campaignReturn;
  try{  
    let sessionAttributes;
    let isUserLockedFlag;
    let source = intentRequest.invocationSource;    
    // console.log("In ", source);

    if(userData){
      isUserLockedFlag = await isUserLocked(userData);
    }
    
    if(source === 'DialogCodeHook') {         
      
      console.log("value of lexUtils.isUserInMiddleOfCampaign(userData)",lexUtils.isUserInMiddleOfCampaign(userData));
      if(userData && lexUtils.isUserInMiddleOfCampaign(userData)){

        let smallTalkCurrentIntent = intentRequest.currentIntent;
        let newIntentRequest,returnPayload;

        if(process && process.env && process.env.ENV){
            newIntentRequest = lexUtils.makeCampaignIntent(intentRequest,process.env.ENV); 
        }
        
        if(newIntentRequest){
            returnPayload = await lexUtils.invokeCampaignProcessor(newIntentRequest);
        }
        
        if(returnPayload){
          callback(JSON.parse(returnPayload.Payload));
        }else{
          console.log("No response back from lambda invoke",returnPayload);
          intentRequest.currentIntent = smallTalkCurrentIntent;
          sessionAttributes = {};
          let slots = intentRequest.currentIntent?.slots;
          slots.inCampaignResponse = "";
          callback(lexUtils.closeDialog(sessionAttributes));
        }

      }
      else if(isUserLockedFlag) {
        let ifActiveCampaign = false; //TODO - add a query to check if user has any campaigns ongoing or not
        
        if(ifActiveCampaign){ 
          let slots = intentRequest.currentIntent?.slots;
          slots.inCampaignResponse = CampaignReplies.SMALLTALK_REDIRECT_MESSAGE_FOR_LOCKED_USER;
          if(slots){
            campaignReturn = lexUtils.delegateDialog({},slots);
          }else{
            let slots = intentRequest.currentIntent?.slots;
            slots.inCampaignResponse = "";
            campaignReturn = lexUtils.delegateDialog({},slots);
          }
        }else{
          let slots = intentRequest.currentIntent?.slots;
          slots.inCampaignResponse = "";
          campaignReturn = lexUtils.delegateDialog({},slots);  
        }        
      }else{
        console.log("No campaign in context - small talk fulfillment to complete");
        let slots = intentRequest.currentIntent?.slots;
        slots.inCampaignResponse = "";
        campaignReturn = lexUtils.delegateDialog({},slots);
      } 
    }

  }catch (error) {
    console.error(error);
  }
    
  console.log("campaignReturn",campaignReturn);  
  callback(campaignReturn);

};

module.exports = {
  dispatchDialog
};