/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_ORGACTION_ARN
	STORAGE_ORGACTION_NAME
	STORAGE_ORGACTION_STREAMARN
Amplify Params - DO NOT EDIT */

const lexUtils = require('@commonutils/lexUtils');
const { updateAction } = require('@dbutils/action');

const dispatchDialog = async function (intentRequest, callback) {
    

  const name = intentRequest.currentIntent?.name;
  lexUtils.populateOrgId(intentRequest);
  lexUtils.populateCommId(intentRequest);
  return processActionProgressUpdate(intentRequest, callback);

};


const processActionProgressUpdate = async function (intentRequest, callback) {

  const outputSessionAttributes = intentRequest.sessionAttributes || {};
  const source = intentRequest.invocationSource;
  let slots = intentRequest.currentIntent?.slots;
  let campaignReturn;


  //fetch data from slots
  let actionId = slots.actionId;
  let actionProgress = slots.actionProgress;
  
  if(actionId && actionProgress){
    let updateParams = { "progress": actionProgress };
    await updateAction(slots.orgId, actionId, updateParams);

    campaignReturn = lexUtils.closeDialog(outputSessionAttributes);
  } else{
    //case when action Data is not passed / captured correctly
    console.error("ERROR - case when action Data is not passed / captured correctly");
  }

  console.log("campaignReturn", campaignReturn);
  callback(campaignReturn);
};


module.exports = {
  dispatchDialog
};