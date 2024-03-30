/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_ORGFAQANSWER_ARN
	STORAGE_ORGFAQANSWER_NAME
	STORAGE_ORGFAQANSWER_STREAMARN
	STORAGE_ORGFAQ_ARN
	STORAGE_ORGFAQ_NAME
	STORAGE_ORGFAQ_STREAMARN
	STORAGE_ORGUSER_ARN
	STORAGE_ORGUSER_NAME
	STORAGE_ORGUSER_STREAMARN
	STORAGE_ORG_ARN
	STORAGE_ORG_NAME
	STORAGE_ORG_STREAMARN
Amplify Params - DO NOT EDIT */
const lexUtils = require('@commonutils/lexUtils');
const {insertFaqToDB} = require('@dbutils/faq');
const services = require('./services');
const {updateUserToDB} = require('@dbutils/user');
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

        if(userData){ 
            return processFaqRequest(intentRequest, userData, callback);
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

const processFaqRequest = async function (intentRequest, userData, callback) {
    try{
        let campaignReturn;
        let source = intentRequest.invocationSource;
        let outputSessionAttributes = intentRequest.sessionAttributes || {};
        let insertParams ;
        let message;
        
        if(source === 'DialogCodeHook') { 
            console.log("In DialogCodeHook");
            if(intentRequest.inputTranscript){

                if(userData && lexUtils.isUserInMiddleOfCampaign(userData)){
                    let fallbackIntent = intentRequest.currentIntent; //storing current intent incase lambda call fails - to set it back
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
                        intentRequest.currentIntent = fallbackIntent;
                        outputSessionAttributes = {};
                        campaignReturn = lexUtils.closeDialog(outputSessionAttributes,CampaignReplies.DEFAULT_ERROR_MESSAGE);
                        callback(campaignReturn); 
                        return ;
                    }

                }else{
                    let queryResponse;
                    if(userData){

                        let sentimentVal,sentimentLabel;
                        if(intentRequest.sentimentResponse){
                            //saving sentiment analyis
                            sentimentLabel = intentRequest.sentimentResponse.sentimentLabel;
                            if(sentimentLabel === 'MIXED'){
                            sentimentLabel = 'NEUTRAL';
                            }
                            sentimentVal = services.extractAndScaleSentimentVal(intentRequest.sentimentResponse.sentimentScore);
                        }

                        //updating last faq interaction date for the user regardless of whther they get an answer or not
                        let userUpdateParams ={ lastInteractionDate : new Date().toISOString() };
                        await updateUserToDB(userData.orgId, userData.userId, userUpdateParams);
                        
                        //Doing Query Search
                        queryResponse = await services.doQuerySearch(userData.orgId,intentRequest.currentIntent.name);
                        if(!queryResponse || (!queryResponse.faqAnswer && !queryResponse.faqAnswerLink) ){
                            //case - no matching faq answer found
                            insertParams = {
                                userId : userData.userId,
                                userText : intentRequest.inputTranscript,
                                sentimentScore : sentimentVal ? sentimentVal : undefined,
                                sentiment : sentimentLabel ? sentimentLabel : undefined
                            };
                            await insertFaqToDB(userData.orgId,insertParams);
                            message = await services.formResponse(userData,services.getRandomFaqNotFoundEndMessage());
                            campaignReturn = lexUtils.closeDialog(outputSessionAttributes,message);                
                            callback(campaignReturn); 
                            return ;
                        }
                        // console.log("faqAnswer+faqQuestion",queryResponse.faqQuestion,queryResponse.faqAnswer);
                    
                        //insert new FAQ item to table
                        insertParams = {
                            userId : userData.userId,
                            userText : intentRequest.inputTranscript,
                            faqQuestion : queryResponse.faqQuestion ? queryResponse.faqQuestion  : undefined,
                            faqAnswer : queryResponse.faqAnswer ? queryResponse.faqAnswer : undefined,
                            sentimentScore : sentimentVal ? sentimentVal : undefined,
                            sentiment : sentimentLabel ? sentimentLabel : undefined
                        };
                        
                        await insertFaqToDB(userData.orgId,insertParams);
                        
                    }else{
                        campaignReturn = lexUtils.closeDialog(outputSessionAttributes,CampaignReplies.DEFAULT_ERROR_MESSAGE);
                        callback(campaignReturn); 
                        return ;
                    }

                    //prepare return message to user
                    if(queryResponse.faqAnswer){
                        message = queryResponse.faqAnswer; //null check already done above
                        //check if there is a URL also for the answer - if yes, append it
                        if(queryResponse.faqAnswerLink){                            
                            message += "\n\n" + "For more information, click here: " + queryResponse.faqAnswerLink;
                        }
                    }else if(queryResponse.faqAnswerLink){                            
                            message = "For information on " + intentRequest.inputTranscript + " click here: " + queryResponse.faqAnswerLink;
                    }
                    let responseCard = await services.makeUserVoteRespCard();
                    message = await services.formResponse(userData,message);
                    campaignReturn = lexUtils.closeDialog(outputSessionAttributes,message,responseCard);
                }
            }
            else{
                let message = "Could not understand your input text, could you ask again?";
                campaignReturn = lexUtils.closeDialog(outputSessionAttributes,message);
            }
        }
        else if (source === 'FulfillmentCodeHook') {
            console.log("In FulfillmentCodeHook - Fallback Intent");

            if(intentRequest.inputTranscript){

                if(userData && lexUtils.isUserInMiddleOfCampaign(userData)){
                    let fallbackIntent = intentRequest.currentIntent; //storing current intent incase lambda call fails - to set it back
                    let newIntentRequest,returnPayload;

                    if(process && process.env && process.env.ENV){
                        newIntentRequest = lexUtils.makeCampaignIntent(intentRequest,process.env.ENV);
                    }
                    
                    if(newIntentRequest){
                        returnPayload = await lexUtils.invokeCampaignProcessor(newIntentRequest);
                    }
                    
                    if(returnPayload){
                        campaignReturn = JSON.parse(returnPayload.Payload);
                        callback(JSON.parse(returnPayload.Payload));
                        
                    }else{
                        console.log("No response back from lambda invoke",returnPayload);
                        intentRequest.currentIntent = fallbackIntent;
                        outputSessionAttributes = {};
                        message = await services.getRandomFaqNotFoundEndMessage();
                        campaignReturn = lexUtils.closeDialog(outputSessionAttributes,message);

                    }

                }else{
                    message = await services.getRandomFaqNotFoundEndMessage();            
                    if(userData){

                        //updating last faq interaction date for the user regardless of whther they get an answer or not
                        let userUpdateParams ={ lastInteractionDate : new Date().toISOString() };
                        await updateUserToDB(userData.orgId, userData.userId, userUpdateParams);
                        
                        insertParams = {
                            userId : userData.userId,
                            userText : intentRequest.inputTranscript,
                        };
                        await insertFaqToDB(userData.orgId,insertParams);
                        message = await services.formResponse(userData,message);
                    }
                    campaignReturn = lexUtils.closeDialog(outputSessionAttributes,message);
                }                    
            }
        }
        
        console.log("campaignReturn", campaignReturn);
        callback(campaignReturn);
    }catch (error) {
        console.error(error);
    }
};


module.exports = {
    dispatchDialog
};