/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_ORGPATTERN_ARN
	STORAGE_ORGPATTERN_NAME
	STORAGE_ORGPATTERN_STREAMARN
Amplify Params - DO NOT EDIT */

const lexUtils = require('@commonutils/lexUtils'); 
const patternTable = process.env.STORAGE_ORGPATTERN_NAME;

const AWS = require('aws-sdk');
AWS.config.update({ region: process.env.TABLE_REGION });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const dispatchDialog = async function (intentRequest, callback) {
    

  const name = intentRequest.currentIntent?.name;
  lexUtils.populateOrgId(intentRequest);
  lexUtils.populateCommId(intentRequest);
  return processIdeaVote(intentRequest, callback);

};


const processIdeaVote = async function (intentRequest, callback) {

  const outputSessionAttributes = intentRequest.sessionAttributes || {};
  const source = intentRequest.invocationSource;
  let slots = intentRequest.currentIntent?.slots;
  let campaignReturn;

  //fetch data from slots
  console.log("INtent Req: ",JSON.stringify(intentRequest));
  let patternId = slots.patternId;
  let voteStrength = slots.vote;

  if(patternId && voteStrength){
    let queryParams = {
      TableName: patternTable,
      Key: {
        "orgId": intentRequest.orgId,
        "patternId": patternId
      },
      UpdateExpression: "SET support = support + :vote, totalVotes = totalVotes + :addOne",
      ExpressionAttributeValues: {
        ":vote": Number(voteStrength),
        ":addOne": 1
      }
    };

    console.log("queryParams",JSON.stringify(queryParams,null,3));
    await dynamodb.update(queryParams).promise();

    campaignReturn = lexUtils.closeDialog(outputSessionAttributes);

  } else{
    //case when idea voting data is not passed correctly
    console.error("ERROR -case when idea voting data is not passed correctly");    
    campaignReturn = lexUtils.closeDialog(outputSessionAttributes);
  }

  console.log("campaignReturn", campaignReturn);
  callback(campaignReturn);
};


module.exports = {
  dispatchDialog
};