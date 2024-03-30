const conversationSearchService = require('@searchutils/conversations');
const employeesSearchService = require('@searchutils/employees');
const commonService = require('@commonutils/services');
const teamsService = require('./teamsService');
const { getFilteredEmployees } = require('@searchutils/employees');
const { getOrgAttribute} = require('@dbutils/org');

/**
 * Function to get distinct user Ids from conversations (CONV#) which are matching the list of pattern IDs passed to the function
 * @param {*} listOfPatternIds 
 * @returns  
 */
const fetchUserIdsFromListOfPatterns = async function (associatedPatterns) {
    try{
        associatedPatterns = JSON.parse(associatedPatterns); //converting the raw string into JSON object
        let listOfPatternIds = [];
        for(const tempObj of associatedPatterns){
            listOfPatternIds.push(tempObj.patternId);
        }
        console.log("Inside fetchUserIdsFromListOfPatterns() - printing listOfPatternIds",listOfPatternIds);    

        let listOfUserIds = await conversationSearchService.getDistinctUserIdsForGivenPatternIds(listOfPatternIds);
        console.log("Inside fetchUserIdsFromListOfPatterns() - printing listOfUserIds",listOfUserIds);    
        return listOfUserIds;
    }catch (error) {
        console.error(error);
    }
};

/**
 * Function to get distinct commId from list of userId passed to the function
 * @param {*} listOfUserIds 
 * @returns  
 */
const fetchCommIdsForListOfUserIds = async function (listOfUserIds){
    try{
        return employeesSearchService.getCommIdsForListOfUserIds(listOfUserIds);
    }catch (error) {
        console.error(error);
    }
}

/**
 * Function to send ping to all users (Action Update) (given comm IDs) - as per the communication channel for the Org
 * @param {*} orgId 
 * @param {*} actionUpdateType //This is either INSERT or MODIFY 
 * @param {*} actionOwner //owner name
 * @param {*} actionText
 * @param {*} listOfCommIds
 * @returns  
 */
const sendPingToListOfUsers = async function (orgId,actionUpdateType,actionOwner,actionText,associatedPatterns,listOfCommIds){
    try{
        console.log("Inside sendPingToListOfUsers() - printing incoming arguments: ",orgId,actionUpdateType,actionOwner,actionText,associatedPatterns,listOfCommIds);

        //getting Org Details. There will only be one orgData returned always
        const getParams = 'commChannel, slackToken, accessToken';
        const orgData = await getOrgAttribute(orgId, getParams);

        //get token 
        let token;
        if (orgData && orgData.Item) {
            if(orgData.Item.commChannel == "Slack"){
                token = orgData.Item.slackToken;
            }
            else if(orgData.Item.commChannel == "Teams"){
                token = orgData.Item.accessToken;
            }
        } else {
            console.error("No token configured for the org : ", orgId);
        }

        if(orgData.Item.commChannel !== undefined){
            if(orgData.Item.commChannel === "Slack"){
                //case if the channel is Slack
                for(const userCommId of listOfCommIds){
                    //looping through all the users to ping
                    let message = draftMessageToSendForActionUpdate(actionUpdateType,actionOwner,actionText,associatedPatterns);
                    await commonService.sendPingToUser(userCommId, token, message);
                }

            }else if(orgData.Item.commChannel === "Teams"){
                let userFilters = [];
                let searchCond = [];
                for(const userCommId of listOfCommIds){
                    userFilters.push({ term: { "commId.keyword": { value: userCommId }}});
                }
                searchCond.push({ bool: { should: [...userFilters]}});
                let userObjs = await  getFilteredEmployees(orgId, searchCond);
                if(userObjs && userObjs.length>0){
                    for(const userObj of userObjs){
                            let message = draftMessageToSendForActionUpdate(actionUpdateType,actionOwner,actionText,associatedPatterns);
                            let messageType = "Text";
                            await teamsService.sendUserMessage(orgId, userObj.commId, userObj.serviceUrl, message, messageType , null) //passing introMessage parameter as undefined
                            .then(async result => {
                            console.log("Sent action to Teams user-",result);
                        })
                        .catch(err => console.error(`Error doing the request for the event: `,err));
                    }
                }
            }
            //TODO - handle email/sms
            }else{
            //default case if channel is not defined, we use Slack
            for(const userCommId of listOfCommIds){
                //looping through all the users to ping
                let message = draftMessageToSendForActionUpdate(actionUpdateType,actionOwner,actionText,associatedPatterns);
                // console.log("Inside sendPingToListOfUsers() - printing message",message);
                await commonService.sendPingToUser(userCommId, token, message);
            }
        }
    }catch (error) {
        console.error(error);
    }
}

const draftMessageToSendForActionUpdate = function (actionUpdateType,actionOwner,actionText,associatedPatterns) {
    let message = null;
    //Randomizing the message between 2 formats
    let index = Math.round(Math.random());
    if(associatedPatterns){
        associatedPatterns = JSON.parse(associatedPatterns);
        var patterns;
        for(const pattern of associatedPatterns){
            console.log("draftMessageToSendForActionUpdate , pattern",pattern);
            patterns = "\"" + pattern.summary + "\" , ";
        }
    }
    if(actionUpdateType === "INSERT"){
        if(index){
            //case when index is 1
            message = "Hello! I have been busy working with people to resolve the pattern -"+ patterns + " that came out of our last conversation.\n";
            message = message + actionOwner + " is working on \"" + actionText +  "\" as the next step.";
        }else{
            //case when index is 0
            message = "Hi, our previous conversations identified a pattern - "+ patterns + " that has impacted multiple people in the organization.\nI assigned an action item: \"";
            message = message + actionText + "\" to "+ actionOwner + ". I will keep you posted as we make progress here.";
        }
    }else if(actionUpdateType === "MODIFY"){
        if(index){
            //case when index is 1
            message = "Hello, I had assigned an action item: \"" + actionText + "\" as a next step from our previous conversation to ";
            message = message + actionOwner + ".\nThe action is now complete. Please do not hesitate to reach out if i can be of any help.";
        }else{
            //case when index is 0
            message = "Hi, the action item uncovered based on your feedback, \"" + actionText + "\" is now complete.\n";
            message = message + "If you have any followup items, please give me a buzz.";
        }
    }
    return message;
} 

module.exports = {
    fetchUserIdsFromListOfPatterns,
    fetchCommIdsForListOfUserIds,
    sendPingToListOfUsers
};
