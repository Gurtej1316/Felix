const lexUtils = require('@commonutils/lexUtils');
const {fetchFaqsFromDBForUser,updateFaqToDB} = require('@dbutils/faq');
const { getFilteredEmployees } = require('@searchutils/employees');
const services = require('./services');


/**
 * delegate the handling to the right base functions
 * @param {*} intentRequest 
 * @param {*} callback 
 * @returns 
*/
const dispatchDialog = async function (intentRequest, callback) {
    

    const name = intentRequest.currentIntent?.name;
    if(intentRequest.sessionAttributes&& intentRequest.sessionAttributes.sessionInit =="webchat"){ 
      // case: incoming message is from Web chat
      intentRequest.orgId = intentRequest.sessionAttributes.orgId;
      intentRequest.userEmail = intentRequest.sessionAttributes.userEmail;
    }
    else if(intentRequest.sessionAttributes && intentRequest.sessionAttributes.sessionInit =="Teams"){
      // case: incoming message is from Teams
      intentRequest.orgId =  intentRequest.sessionAttributes.orgId;
      intentRequest.commId = intentRequest.sessionAttributes.commId;
    }
    else if(intentRequest.requestAttributes && intentRequest.requestAttributes['x-amz-lex:channel-type'] && 
            intentRequest.requestAttributes['x-amz-lex:channel-type'] === "Slack"){
      // case: incoming message is from Slack
  	  lexUtils.populateOrgId(intentRequest);
      lexUtils.populateCommId(intentRequest);
    }
    else{
        //no case matching for incoming source
        let sessionAttributes = {};
        let campaignReturn = lexUtils.closeDialog(sessionAttributes);
        callback(campaignReturn);   
        return ;
    }
    
    return faqVoteCapture(name,intentRequest, callback);

};

const faqVoteCapture = async function (intentName,intentRequest, callback) {
    var source = intentRequest.invocationSource;
    let slots = intentRequest.currentIntent?.slots;
    var outputSessionAttributes = intentRequest.sessionAttributes || {};
    let campaignReturn;
    
    if(source === 'DialogCodeHook') { 
        console.log("In DialogCodeHook");
        campaignReturn = lexUtils.closeDialog(outputSessionAttributes);

    }
    else if (source === 'FulfillmentCodeHook') {
        console.log("In FulfillmentCodeHook");
        
        if(slots.userVote){
        
            let searchCond = [];
            if(intentRequest.commId){
                searchCond.push({ match: { "commId.keyword": intentRequest.commId } });
            }
            if(intentRequest.userEmail){
                searchCond.push({ match: { "userEmail.keyword": intentRequest.userEmail } });
            }
            
            //fetch user data using commId
            let userData = await getFilteredEmployees(intentRequest.orgId,searchCond);
            userData = userData && userData[0] ? userData[0] : undefined; //setting userData[0] to userData for better readability for the rest of the code
            
            let allUserFaqs;
            if(userData){
                //fetch all FAQs of the user
                allUserFaqs = await fetchFaqsFromDBForUser(userData.orgId,userData.userId);
                console.log("allUserFaqs",allUserFaqs);
                
                //sort and get the last one (by createdDate)
                if(allUserFaqs && allUserFaqs.length > 0){
                    allUserFaqs.sort(function(a,b){
                        return new Date(b.createdDate) - new Date(a.createdDate);
                    });
                    console.log("the latest FAQ",allUserFaqs[0]); 
                }
            }
            
            let returnMessage = "";
    
            //checks on existence of slot value, last faq not having a userVote
            //update it, save it
            if(allUserFaqs && allUserFaqs[0]){
                if(!allUserFaqs[0].userVote){
                    let updateParams = {
                        userVote : slots.userVote
                    };
                    
                    await updateFaqToDB(allUserFaqs[0].orgId,allUserFaqs[0].faqId,updateParams);   
                    
                    //custom return message on the basis of vote
                    if(slots.userVote === "Yes" || slots.userVote === "No"){
                        returnMessage = services.getRandomReplyMessage(slots.userVote);
                    }else {
                        //handling the case when the slot value has some other value than Yes or No
                        returnMessage = "Thanks for your response";
                    }
            
                }
                else{
                    //case when someone is re voting
                    //we send a graceful message, do not update anything
                    returnMessage = "We have already captured your vote, thank you for being as excited as me!"
                }
            }
            
            campaignReturn = lexUtils.closeDialog(outputSessionAttributes,returnMessage);
            
        }else{
            
            campaignReturn = lexUtils.closeDialog(outputSessionAttributes);
        }
        
    }
    
    console.log("campaignReturn", campaignReturn);
    callback(campaignReturn); 
    
};

module.exports = {
    dispatchDialog
};